/**
 * Politique CORS centralisée (HTTP + WebSocket).
 *
 * — En PRODUCTION : origines listées dans CORS_ORIGIN (séparées par des
 *   virgules), l'apex https://fasofree.site, ses sous-domaines
 *   (*.fasofree.site) ainsi que *.vercel.app et *.onrender.com.
 * — En DEV : CORS_ORIGIN + origines locales uniquement. Plus jamais
 *   d'allow-all en développement.
 *
 * Chaque origine non-Env doit correspondre à un pattern explicite :
 * aucune valeur de secours générique.
 */

// Origines locales de développement (Vite / Next / CRA) — dev uniquement
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:4173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:4173',
];

// Patterns autorisés en production : apex fasofree.site, sous-domaines
// fasofree.site, frontends Vercel et backends Render.
const PROD_PATTERNS = [
  /^https:\/\/(www\.)?fasofree\.site$/,
  /\.fasofree\.site$/,
  /\.vercel\.app$/,
  /\.onrender\.com$/,
];

/**
 * Détermine si une origine est autorisée.
 * @param origin Origine (ex. https://fasofree.site) — vide pour les appels
 *               sans en-tête Origin (curl, serveur-à-serveur), autorisés.
 */
export function originAllowed(origin: string): boolean {
  if (!origin) return true;

  const envOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (envOrigins.includes(origin)) return true;

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    return PROD_PATTERNS.some((re) => re.test(origin));
  }
  return DEV_ORIGINS.includes(origin);
}