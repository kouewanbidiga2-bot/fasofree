import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ─── Métriques personnalisées ───────────────────────────────────────────────
const ordersCreated = new Counter('orders_created');
const loginSuccess = new Counter('login_success');
const loginFailed = new Counter('login_failed');
const restaurantsViewed = new Counter('restaurants_viewed');
const paymentsProcessed = new Counter('payments_processed');
const errors = new Counter('errors');
const errorRate = new Rate('error_rate');
const loginDuration = new Trend('login_duration');
const orderDuration = new Trend('order_duration');

// ─── Configuration ──────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'https://api.fasofree.site/api/v1';

export const options = {
  // Simulation d'une forte clientèle (heure de pointe)
  scenarios: {
    // Scénario 1 : Flood de clients qui parcourent les restaurants
    browse_restaurants: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // Montée progressive
        { duration: '1m', target: 100 },   // Pic de clients
        { duration: '2m', target: 150 },   // Forte affluence
        { duration: '30s', target: 200 },  // Peak absolu (promo flash)
        { duration: '1m', target: 100 },   // Descente
        { duration: '30s', target: 0 },    // Fin
      ],
      exec: 'browseFlow',
    },

    // Scénario 2 : Clients qui commandent en même temps
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

    // Scénario 3 : Livreurs qui acceptent et livrent
    driver_activity: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      exec: 'driverFlow',
    },

    // Scénario 4 : Admins qui gèrent en后台
    admin_activity: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5m',
      exec: 'adminFlow',
    },
  },

  thresholds: {
    http_req_duration: [{ threshold: 'p(95)<3000', abortOnFail: false }],
    http_req_failed: [{ threshold: 'rate<0.3' }],
    error_rate: [{ threshold: 'rate<0.3' }],
    login_duration: [{ threshold: 'p(95)<2000' }],
    order_duration: [{ threshold: 'p(95)<5000' }],
  },
};

// ─── Données de test ────────────────────────────────────────────────────────
const TEST_USERS = [
  { email: 'test.client@fasofree.bf', password: 'Test@12345', role: 'client' },
  { email: 'test.client2@fasofree.bf', password: 'Test@12345', role: 'client' },
  { email: 'test.client3@fasofree.bf', password: 'Test@12345', role: 'client' },
];

const TEST_DRIVERS = [
  { email: 'test.driver@fasofree.bf', password: 'Test@12345' },
  { email: 'test.driver2@fasofree.bf', password: 'Test@12345' },
];

const TEST_ADMINS = [
  { email: 'admin@chitirchicken.bf', password: 'Test@12345' },
  { email: 'test.merchant@fasofree.bf', password: 'Test@12345' },
];

const TEST_RESTAURANTS = ['chitir-chicken', 'fosso-pizza', 'mama-africa'];
const PAYMENT_METHODS = ['moov', 'mosamo', 'coris', 'zip', 'wave'];

// ─── Fonctions utilitaires ──────────────────────────────────────────────────
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePhone() {
  const prefix = ['70', '71', '72', '73', '74', '75', '76', '77', '78'];
  return `+226${randomItem(prefix)}${Math.floor(1000000 + Math.random() * 9000000)}`;
}

function makeHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}

// ─── Auth helper ────────────────────────────────────────────────────────────
function login(user) {
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ login: user.email, password: user.password }),
    makeHeaders()
  );

  const duration = Date.now() - start;
  loginDuration.add(duration);

  const ok = check(res, {
    'login: status 200': (r) => r.status === 200,
    'login: has token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.accessToken || body.token;
      } catch {
        return false;
      }
    },
  });

  if (ok) {
    loginSuccess.add(1);
    try {
      const body = JSON.parse(res.body);
      return body.accessToken || body.token;
    } catch {
      return null;
    }
  } else {
    loginFailed.add(1);
    errors.add(1);
    errorRate.add(1);
    return null;
  }
}

// ─── Scénario 1 : Parcourir les restaurants ─────────────────────────────────
export function browseFlow() {
  const headers = makeHeaders();

  // 1. Page d'accueil — charger les restaurants groupés
  const homeRes = http.get(`${BASE_URL}/businesses/grouped`, headers);
  check(homeRes, {
    'browse: grouped restaurants 200': (r) => r.status === 200,
  }) || errors.add(1);
  restaurantsViewed.add(1);

  sleep(Math.random() * 3 + 1); // 1-4s de lecture

  // 2. Voir les produits d'un restaurant
  const restaurant = randomItem(TEST_RESTAURANTS);
  const prodRes = http.get(`${BASE_URL}/products?businessId=${restaurant}`, headers);
  check(prodRes, {
    'browse: products 200': (r) => r.status === 200,
  }) || errors.add(1);

  sleep(Math.random() * 4 + 2); // 2-6s à regarder le menu

  // 3. Voir les catégories
  const catRes = http.get(`${BASE_URL}/products/categories`, headers);
  check(catRes, {
    'browse: categories 200': (r) => r.status === 200,
  }) || errors.add(1);

  sleep(Math.random() * 2 + 1);

  // 4. Parcourir les agences/branches d'une marque
  const brandRes = http.get(`${BASE_URL}/businesses/grouped`, headers);
  check(brandRes, {
    'browse: brands 200': (r) => r.status === 200,
  }) || errors.add(1);

  sleep(Math.random() * 3 + 1);

  errorRate.add(0);
}

// ─── Scénario 2 : Passer une commande ──────────────────────────────────────
export function orderFlow() {
  const user = randomItem(TEST_USERS);

  // 1. Login
  const token = login(user);
  if (!token) return;
  sleep(Math.random() * 2 + 1);

  const headers = makeHeaders(token);

  // 2. Voir les produits
  const restaurant = randomItem(TEST_RESTAURANTS);
  const prodRes = http.get(`${BASE_URL}/products?businessId=${restaurant}`, headers);
  check(prodRes, {
    'order: products loaded': (r) => r.status === 200,
  }) || errors.add(1);

  sleep(Math.random() * 2 + 1);

  // 3. Ajouter au panier
  let products = [];
  try {
    const prodBody = JSON.parse(prodRes.body);
    products = prodBody.data || prodBody.products || prodBody;
    if (!Array.isArray(products)) products = [];
  } catch {}

  if (products.length === 0) {
    errorRate.add(1);
    return;
  }

  const selectedProducts = [];
  const numItems = Math.min(Math.floor(Math.random() * 3) + 1, products.length);
  for (let i = 0; i < numItems; i++) {
    const prod = randomItem(products);
    selectedProducts.push({
      productId: prod.id,
      productName: prod.name,
      quantity: Math.floor(Math.random() * 3) + 1,
      unitPrice: prod.price || prod.pricePerUnit || 2500,
    });
  }

  sleep(Math.random() * 3 + 1); // 3-4s dans le panier

  // 4. Passer la commande
  const orderStart = Date.now();
  const orderPayload = {
    businessSlug: restaurant,
    items: selectedProducts,
    deliveryType: Math.random() > 0.4 ? 'delivery' : 'onsite',
    address: Math.random() > 0.4 ? 'Ouaga 2000, near Collège Saint-Exupéry' : undefined,
    paymentMethod: randomItem(PAYMENT_METHODS),
    phone: user.email.replace('@fasofree.bf', '').replace('test.', '+2267'),
    notes: Math.random() > 0.7 ? 'Pas de piment svp' : undefined,
  };

  const orderRes = http.post(
    `${BASE_URL}/orders`,
    JSON.stringify(orderPayload),
    headers
  );

  const orderDurationMs = Date.now() - orderStart;
  orderDuration.add(orderDurationMs);

  const orderOk = check(orderRes, {
    'order: created (200/201)': (r) => r.status === 200 || r.status === 201,
  });

  if (orderOk) {
    ordersCreated.add(1);

    // 5. Simuler le paiement (si la commande a un ID)
    try {
      const orderBody = JSON.parse(orderRes.body);
      const orderId = orderBody.id || orderBody.data?.id || orderBody.order?.id;

      if (orderId) {
        sleep(Math.random() * 2 + 1);

        const payRes = http.post(
          `${BASE_URL}/payments/${orderId}/init`,
          JSON.stringify({
            method: randomItem(PAYMENT_METHODS),
            amount: selectedProducts.reduce((sum, p) => sum + p.unitPrice * p.quantity, 0),
          }),
          headers
        );

        check(payRes, {
          'payment: initiated': (r) => r.status === 200 || r.status === 201 || r.status === 402,
        }) || errors.add(1);

        paymentsProcessed.add(1);
      }
    } catch {}

    errorRate.add(0);
  } else {
    errors.add(1);
    errorRate.add(1);
  }

  // 6. Vérifier le statut de la commande
  sleep(Math.random() * 5 + 3);

  if (orderOk) {
    try {
      const orderBody = JSON.parse(orderRes.body);
      const orderId = orderBody.id || orderBody.data?.id || orderBody.order?.id;

      if (orderId) {
        const statusRes = http.get(`${BASE_URL}/orders/${orderId}`, headers);
        check(statusRes, {
          'order status: fetched': (r) => r.status === 200,
        }) || errors.add(1);
      }
    } catch {}
  }

  // 7. Notification push simulée (等待)
  sleep(Math.random() * 10 + 5);
}

// ─── Scénario 3 : Activité livreur ─────────────────────────────────────────
export function driverFlow() {
  const driver = randomItem(TEST_DRIVERS);
  const token = login(driver);
  if (!token) return;

  const headers = makeHeaders(token);

  // 1. Voir les commandes disponibles
  const availRes = http.get(`${BASE_URL}/drivers/available-orders`, headers);
  check(availRes, {
    'driver: available orders 200': (r) => r.status === 200,
  }) || errors.add(1);

  sleep(Math.random() * 5 + 3); // 3-8s d'attente

  // 2. Accepter une commande (si disponible)
  try {
    const body = JSON.parse(availRes.body);
    const orders = body.data || body.orders || body;
    if (Array.isArray(orders) && orders.length > 0) {
      const order = randomItem(orders);
      const acceptRes = http.post(
        `${BASE_URL}/drivers/accept-order/${order.id || order._id}`,
        JSON.stringify({}),
        headers
      );
      check(acceptRes, {
        'driver: order accepted': (r) => r.status === 200 || r.status === 201,
      }) || errors.add(1);

      sleep(Math.random() * 15 + 10); // 10-25s de livraison simulée

      // 3. Marquer comme livrée
      const completeRes = http.post(
        `${BASE_URL}/drivers/complete-delivery/${order.id || order._id}`,
        JSON.stringify({}),
        headers
      );
      check(completeRes, {
        'driver: delivery completed': (r) => r.status === 200,
      }) || errors.add(1);
    }
  } catch {}

  // 4. Vérifier les earnings
  const earnRes = http.get(`${BASE_URL}/drivers/earnings`, headers);
  check(earnRes, {
    'driver: earnings 200': (r) => r.status === 200,
  }) || errors.add(1);

  sleep(Math.random() * 3 + 2);
}

// ─── Scénario 4 : Activité admin ───────────────────────────────────────────
export function adminFlow() {
  const admin = randomItem(TEST_ADMINS);
  const token = login(admin);
  if (!token) return;

  const headers = makeHeaders(token);

  // 1. Dashboard
  const dashRes = http.get(`${BASE_URL}/businesses/me`, headers);
  check(dashRes, {
    'admin: dashboard 200': (r) => r.status === 200,
  }) || errors.add(1);

  sleep(Math.random() * 5 + 3);

  // 2. Voir les commandes
  const ordersRes = http.get(`${BASE_URL}/orders?limit=20`, headers);
  check(ordersRes, {
    'admin: orders list 200': (r) => r.status === 200,
  }) || errors.add(1);

  sleep(Math.random() * 3 + 2);

  // 3. Analytics
  const analyticsRes = http.get(`${BASE_URL}/analytics/my-business`, headers);
  check(analyticsRes, {
    'admin: analytics 200': (r) => r.status === 200,
  }) || errors.add(1);

  sleep(Math.random() * 3 + 2);

  // 4. Wallet
  const walletRes = http.get(`${BASE_URL}/wallets/my-wallet`, headers);
  check(walletRes, {
    'admin: wallet 200': (r) => r.status === 200,
  }) || errors.add(1);

  sleep(Math.random() * 3 + 2);

  // 5. Produits
  const prodRes = http.get(`${BASE_URL}/products?limit=20`, headers);
  check(prodRes, {
    'admin: products 200': (r) => r.status === 200,
  }) || errors.add(1);

  sleep(Math.random() * 3 + 2);
}

// ─── Default flow (fallback) ────────────────────────────────────────────────
export default function () {
  browseFlow();
}

// ─── Résumé ─────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const avg = data.metrics.http_req_duration?.values?.avg || 0;
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] || 0;
  const max = data.metrics.http_req_duration?.values?.max || 0;
  const totalReqs = data.metrics.http_reqs?.values?.count || 0;
  const failRate = data.metrics.http_req_failed?.values?.rate || 0;

  console.log('\n📊 ═══════════════════════════════════════════════');
  console.log('   RÉSULTATS DU LOAD TEST — FASOFREE');
  console.log('══════════════════════════════════════════════════');
  console.log(`⏱️  Durée totale      : ${(max / 1000).toFixed(1)}s`);
  console.log(`📡 Requêtes totales   : ${totalReqs}`);
  console.log(`❌ Échecs             : ${(failRate * 100).toFixed(1)}%`);
  console.log(`⚡ Temps moyen        : ${avg.toFixed(0)}ms`);
  console.log(`📈 P95                : ${p95.toFixed(0)}ms`);
  console.log(`📈 P99                : ${p99.toFixed(0)}ms`);
  console.log(`🛒 Commandes crées    : ${data.metrics.orders_created?.values?.count || 0}`);
  console.log(`🔐 Logins OK          : ${data.metrics.login_success?.values?.count || 0}`);
  console.log(`🔐 Logins échoués     : ${data.metrics.login_failed?.values?.count || 0}`);
  console.log(`⚠️  Taux d'erreur      : ${(failRate * 100).toFixed(1)}%`);
  console.log('══════════════════════════════════════════════════\n');

  return {
    'k6-results.json': JSON.stringify({
      timestamp: new Date().toISOString(),
      duration: max,
      totalRequests: totalReqs,
      failedRequests: failRate,
      avgResponseTime: avg,
      p95ResponseTime: p95,
      ordersCreated: data.metrics.orders_created?.values?.count || 0,
      loginSuccess: data.metrics.login_success?.values?.count || 0,
      loginFailed: data.metrics.login_failed?.values?.count || 0,
    }, null, 2),
  };
}
