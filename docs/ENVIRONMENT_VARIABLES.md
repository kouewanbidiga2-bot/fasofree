# Variables d'environnement — FasoFree Backend

Référence des variables pour **staging / production**. Aucun secret n'est codé en dur dans le code ni dans `.env.example` (valeurs placeholder uniquement).

> Règle d'or : **en production**, les secrets vitaux (`JWT_SECRET`, `DATABASE_URL`…) sont **obligatoires**. Le backend refuse de démarrer (fail-fast) s'ils sont manquants — voir `src/main.ts` → `validateCriticalConfig()`.

## Configuration critique (obligatoire en prod — défaut refusé au démarrage)

| Variable | Description |
|---|---|
| `JWT_SECRET` | Secret de signature JWT, **≥ 32 caractères**. |
| `DATABASE_URL` | URL PostgreSQL (Neon) `postgresql://…?sslmode=require`. |

## Général / déploiement

| Variable | Défaut | Description |
|---|---|---|
| `NODE_ENV` | `development` | `production` active le mode strict. |
| `PORT` | `3100` | Port HTTP (Render injecte `1000`). |
| `CORS_ORIGIN` | *(vide)* | Origines autorisées en prod, séparées par des virgules. Toute autre origine est **rejetée** (CORS fail-closed). |

## Base de données (migrations)

| Variable | Défaut | Description |
|---|---|---|
| `DB_SYNCHRONIZE` | `false` | **Ignoré en production** : synchronize y est toujours désactivé (imposé par `database.config.ts`). |
| `DB_MIGRATIONS_RUN` | `false` | `true` en production : les migrations TypeORM s'exécutent au boot. |
| `DB_HOST`…`DB_SSL` | unit | Params individuels (fallback si pas d'URL complète). |

## Sécurité / rate limiting

| Variable | Défaut | Description |
|---|---|---|
| `PAYMENT_WEBHOOK_SECRET` | *(vide)* | Secret global webhooks. |
| `THROTTLE_TTL_MS` | `60000` | Fenêtre du rate limiter (ms). |
| `THROTTLE_LIMIT` | `100` | Limite de requêtes par IP par fenêtre. |

## Paiements

| Variable | Description |
|---|---|
| `PAYMENT_PROVIDER` | `mock` \| `ligdicash` \| `cinetpay` \| `wave`. |
| `PAYMENT_ENV` | `sandbox` \| `live`. |
| `GENIUSPAY_API_KEY` / `GENIUSPAY_API_SECRET` | Clés GeniusPay. |
| `GENIUSPAY_WEBHOOK_SECRET` | **Obligatoire en prod** : sans lui, les webhooks GeniusPay sont rejetés (fail-closed). |
| `CINETPAY_API_KEY` / `CINETPAY_SITE_ID` / `CINETPAY_BASE_URL` | CinetPay. |
| `LIGDICASH_API_KEY` / `LIGDICASH_AUTH_TOKEN` / `LIGDICASH_PAYOUT_TOKEN` | LigdiCash (le token webhook est fail-closed). |
| `PAYDUNYA_MASTER_KEY` / `PAYDUNYA_PRIVATE_KEY` / `PAYDUNYA_TOKEN` / `PAYDUNYA_MODE` | PayDunya (hash webhook SHA-512 du master key, fail-closed). |
| `YENGAPAY_WEBHOOK_SECRET` | **Obligatoire** : sans lui, les webhooks YengaPay sont rejetés (fail-closed). |

## Payouts / reversements

| Variable | Défaut | Description |
|---|---|---|
| `PAYOUTS_SIMULATION_ENABLED` | *(vide)* | `true` pour simuler les reversements. |
| `CINETPAY_PAYOUT_KEY` / `CINETPAY_PAYOUT_SECRET` | — | Reversements CinetPay. |
| `PAYOUT_MIN_AMOUNT_FCFA` | `1000` | Seuil minimal de payout. |

## Notifications

| Variable | Description |
|---|---|
| `SMTP_USER` / `SMTP_PASS` | Gmail SMTP (principal). |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Fallback Resend. |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Meta Cloud API. |
| `WHATSAPP_VERIFY_TOKEN` | Jeton de vérification **GET** — aucune valeur par défaut. |
| `WHATSAPP_APP_SECRET` | App Secret Meta pour vérifier `X-Hub-Signature-256` des événements **POST** (fail-closed). |
| `SMS_PROVIDER` | `fallback`. |

## Stockage, push, monitoring

| Variable | Description |
|---|---|
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Stockage prioritaires. |
| `AWS_S3_BUCKET` / `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_CDN_URL` / `AWS_S3_ENDPOINT` | S3 / R2 fallback. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` (ou `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`) | FCM push. |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` | Monitoring Sentry. |
| `REDIS_URL` (ou params individuels) | Redis / Upstash. |
