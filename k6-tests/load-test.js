import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const ordersCreated = new Counter('orders_created');
const loginSuccess = new Counter('login_success');
const loginFailed = new Counter('login_failed');
const restaurantsViewed = new Counter('restaurants_viewed');
const errors = new Counter('errors');
const errorRate = new Rate('error_rate');
const loginDuration = new Trend('login_duration');
const orderDuration = new Trend('order_duration');

const BASE_URL = __ENV.BASE_URL || 'https://api.fasofree.site/api/v1';

export const options = {
  scenarios: {
    browse_restaurants: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '2m', target: 150 },
        { duration: '30s', target: 200 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      exec: 'browseFlow',
    },
    order_simultaneously: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 30 },
        { duration: '2m', target: 80 },
        { duration: '1m', target: 40 },
        { duration: '30s', target: 0 },
      ],
      exec: 'orderFlow',
    },
    driver_activity: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      exec: 'driverFlow',
    },
    admin_activity: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5m',
      exec: 'adminFlow',
    },
  },
  thresholds: {
    http_req_duration: [{ threshold: 'p(95)<5000', abortOnFail: false }],
    http_req_failed: [{ threshold: 'rate<0.4' }],
  },
};

const TEST_CLIENTS = [
  { email: 'test.client@fasofree.bf', password: 'Test@12345' },
];
const TEST_DRIVERS = [
  { email: 'test.driver@fasofree.bf', password: 'Test@12345' },
];
const TEST_ADMINS = [
  { email: 'admin@chitirchicken.bf', password: 'Test@12345' },
];
const PAYMENT_METHODS = ['moov', 'mosamo', 'coris', 'zip', 'wave'];

function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function hdr(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}

// Cache partagé pour les business IDs récupérés dynamiquement
let sharedBusinessIds = [];

function fetchBusinessIds() {
  if (sharedBusinessIds.length > 0) return sharedBusinessIds;
  const res = http.get(`${BASE_URL}/businesses/grouped`, hdr());
  try {
    const body = JSON.parse(res.body);
    const data = body.data || body;
    if (Array.isArray(data)) {
      sharedBusinessIds = data
        .map(b => b.businessId || b.id)
        .filter(Boolean)
        .slice(0, 5);
    }
  } catch {}
  return sharedBusinessIds;
}

// ─── LOGIN ──────────────────────────────────────────────────────────────────
function doLogin(user) {
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: user.email, password: user.password }),
    hdr()
  );
  loginDuration.add(Date.now() - start);

  const ok = check(res, {
    'login: 200': (r) => r.status === 200,
    'login: token': (r) => {
      try { return !!JSON.parse(r.body).accessToken; } catch { return false; }
    },
  });

  if (ok) {
    loginSuccess.add(1);
    try { return JSON.parse(res.body).accessToken; } catch { return null; }
  }
  loginFailed.add(1);
  errors.add(1);
  errorRate.add(1);
  return null;
}

// ─── BROWSE (PUBLIC) ────────────────────────────────────────────────────────
export function browseFlow() {
  const h = hdr();
  const bizIds = fetchBusinessIds();

  // 1. Grouped
  const g = http.get(`${BASE_URL}/businesses/grouped`, h);
  check(g, { 'browse: grouped': (r) => r.status === 200 }) || errors.add(1);
  restaurantsViewed.add(1);
  sleep(Math.random() * 2 + 0.5);

  // 2. Nearby
  const n = http.get(`${BASE_URL}/businesses/nearby?lat=12.3714&lng=-1.5197&radius=10`, h);
  check(n, { 'browse: nearby': (r) => r.status === 200 }) || errors.add(1);
  sleep(Math.random() * 1 + 0.5);

  // 3. Business detail
  if (bizIds.length > 0) {
    const biz = http.get(`${BASE_URL}/businesses/${rnd(bizIds)}`, h);
    check(biz, { 'browse: detail': (r) => r.status === 200 }) || errors.add(1);
    sleep(Math.random() * 2 + 1);

    // 4. Products
    const p = http.get(`${BASE_URL}/products/business/${rnd(bizIds)}`, h);
    check(p, { 'browse: products': (r) => r.status === 200 }) || errors.add(1);
    sleep(Math.random() * 2 + 1);
  }

  // 5. Brands
  const b = http.get(`${BASE_URL}/brands`, h);
  check(b, { 'browse: brands': (r) => r.status === 200 }) || errors.add(1);
  sleep(Math.random() * 1 + 0.5);

  errorRate.add(0);
}

// ─── ORDER ──────────────────────────────────────────────────────────────────
export function orderFlow() {
  const user = rnd(TEST_CLIENTS);
  const token = doLogin(user);
  if (!token) return;
  sleep(1);

  const h = hdr(token);
  const bizIds = fetchBusinessIds();
  if (bizIds.length === 0) { errors.add(1); return; }

  const bizId = rnd(bizIds);

  // 1. Products
  const pRes = http.get(`${BASE_URL}/products/business/${bizId}`, h);
  check(pRes, { 'order: products': (r) => r.status === 200 }) || errors.add(1);
  sleep(Math.random() * 2 + 1);

  // 2. Build cart
  let products = [];
  try {
    const body = JSON.parse(pRes.body);
    products = Array.isArray(body) ? body : (body.data || []);
  } catch {}
  if (products.length === 0) { errors.add(1); return; }

  const items = [];
  const n = Math.min(Math.floor(Math.random() * 3) + 1, products.length);
  for (let i = 0; i < n; i++) {
    const p = rnd(products);
    items.push({
      productId: p.id,
      productName: p.name,
      quantity: Math.floor(Math.random() * 3) + 1,
      unitPrice: p.price || 2500,
    });
  }
  sleep(Math.random() * 2 + 1);

  // 3. Quote
  const qRes = http.post(`${BASE_URL}/orders/quote`, JSON.stringify({
    businessId: bizId,
    items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
    deliveryType: 'delivery',
  }), h);
  check(qRes, { 'order: quote': (r) => r.status === 200 }) || errors.add(1);
  sleep(1);

  // 4. Create order
  const start = Date.now();
  const oRes = http.post(`${BASE_URL}/orders`, JSON.stringify({
    businessId: bizId,
    items,
    deliveryType: Math.random() > 0.4 ? 'delivery' : 'onsite',
    address: Math.random() > 0.4 ? 'Ouaga 2000' : undefined,
    paymentMethod: rnd(PAYMENT_METHODS),
    phone: `+2267${Math.floor(1000000 + Math.random() * 9000000)}`,
  }), h);
  orderDuration.add(Date.now() - start);

  const ok = check(oRes, { 'order: created': (r) => r.status === 200 || r.status === 201 });
  if (ok) {
    ordersCreated.add(1);
    errorRate.add(0);
    try {
      const body = JSON.parse(oRes.body);
      const oid = body.id || body.data?.id || body.order?.id;
      if (oid) {
        sleep(2);
        http.get(`${BASE_URL}/orders/${oid}`, h);
        sleep(1);
        http.get(`${BASE_URL}/orders/my-orders`, h);
      }
    } catch {}
  } else {
    errors.add(1);
    errorRate.add(1);
  }
  sleep(Math.random() * 3 + 2);
}

// ─── DRIVER ─────────────────────────────────────────────────────────────────
export function driverFlow() {
  const token = doLogin(rnd(TEST_DRIVERS));
  if (!token) return;
  const h = hdr(token);

  const avail = http.get(`${BASE_URL}/dispatch/available`, h);
  check(avail, { 'driver: available': (r) => r.status === 200 }) || errors.add(1);
  sleep(Math.random() * 3 + 2);

  try {
    const body = JSON.parse(avail.body);
    const orders = Array.isArray(body) ? body : (body.data || []);
    if (orders.length > 0) {
      const oid = rnd(orders).id || rnd(orders)._id;
      const acc = http.post(`${BASE_URL}/dispatch/accept/${oid}`, JSON.stringify({}), h);
      check(acc, { 'driver: accept': (r) => r.status === 200 || r.status === 201 }) || errors.add(1);
      sleep(Math.random() * 5 + 3);
      http.post(`${BASE_URL}/orders/${oid}/driver-validate`, JSON.stringify({}), h);
    }
  } catch {}
  sleep(2);
}

// ─── ADMIN ──────────────────────────────────────────────────────────────────
export function adminFlow() {
  const token = doLogin(rnd(TEST_ADMINS));
  if (!token) return;
  const h = hdr(token);

  const biz = http.get(`${BASE_URL}/businesses/me`, h);
  check(biz, { 'admin: me': (r) => r.status === 200 }) || errors.add(1);
  sleep(2);

  let bizId = null;
  try { bizId = JSON.parse(biz.body).id || JSON.parse(biz.body).data?.id; } catch {}

  if (bizId) {
    http.get(`${BASE_URL}/orders/business/${bizId}`, h);
    sleep(2);
    http.get(`${BASE_URL}/products/business/${bizId}`, h);
    sleep(2);
  }
  http.get(`${BASE_URL}/analytics/my-business`, h);
  sleep(2);
}

// ─── Default ────────────────────────────────────────────────────────────────
export default function () { browseFlow(); }

// ─── Summary ────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const m = data.metrics;
  const avg = m.http_req_duration?.values?.avg || 0;
  const p95 = m.http_req_duration?.values?.['p(95)'] || 0;
  const max = m.http_req_duration?.values?.max || 0;
  const total = m.http_reqs?.values?.count || 0;
  const fail = m.http_req_failed?.values?.rate || 0;

  console.log('\n📊 ═══════════════════════════════════════════════');
  console.log('   RÉSULTATS DU LOAD TEST — FASOFREE');
  console.log('══════════════════════════════════════════════════');
  console.log(`⏱️  Durée             : ${(max / 1000).toFixed(1)}s`);
  console.log(`📡 Requêtes           : ${total}`);
  console.log(`❌ Échecs             : ${(fail * 100).toFixed(1)}%`);
  console.log(`⚡ Temps moyen        : ${avg.toFixed(0)}ms`);
  console.log(`📈 P95                : ${p95.toFixed(0)}ms`);
  console.log(`🛒 Commandes         : ${m.orders_created?.values?.count || 0}`);
  console.log(`🔐 Logins OK          : ${m.login_success?.values?.count || 0}`);
  console.log(`🔐 Logins fail        : ${m.login_failed?.values?.count || 0}`);
  console.log('══════════════════════════════════════════════════\n');

  return {
    'k6-results.json': JSON.stringify({
      timestamp: new Date().toISOString(),
      maxDuration: max,
      totalRequests: total,
      failRate: fail,
      avgMs: avg,
      p95Ms: p95,
      orders: m.orders_created?.values?.count || 0,
      loginsOk: m.login_success?.values?.count || 0,
      loginsFail: m.login_failed?.values?.count || 0,
    }, null, 2),
  };
}
