# Production — FasoFree Backend

## Architecture
- **Monolithe modulaire** NestJS (API `/api/v1`) + PostgreSQL (Neon) + Redis (Upstash) + Vercel/Render.
- Déploiement via **Render** (`render.yaml`) : `fasofree-api` (Docker), `fasofree-admin`, `fasofree-client`.

## Base de données : migrations vs synchronize
- **`synchronize` est interdit en production** (imposé dans `database.config.ts`, la surcharge `DB_SYNCHRONIZE` y est ignorée).
- Le schéma est géré par les **migrations** TypeORM : `DB_MIGRATIONS_RUN=true` (voir `render.yaml`).
- Les migrations vivent dans `fasofree-backend/src/database/migrations/`. Les commandes :
  ```bash
  # générer une migration après modif d'entités
  npx typeorm migration:generate src/database/migrations/<Timestamp>-<name> -d <data-source>
  # lancer manuellement
  npm run typeorm:migration:run   # (à définir selon le projet)
  ```
  > ⚠️ Les migrations doivent être **additives** (`IF NOT EXISTS`) : la base prod existante a été créée historiquement via `synchronize`.

## Santé / redémarrage
- `GET /api/v1/health/live` — liveness (l'instance est vivante).
- `GET /api/v1/health/ready` — readiness (ping base de données). Le healthcheck Render pointe ici.
- `GET /api/v1/health` — alias de readiness (rétrocompatibilité).

## Configuration requise en production
Voir [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md). Essentiel :
- `JWT_SECRET`, `DATABASE_URL` (fail-fast si absents).
- Secrets de webhooks : `GENIUSPAY_WEBHOOK_SECRET`, `YENGAPAY_WEBHOOK_SECRET`, `PAYDUNYA_MASTER_KEY`, `LIGDICASH_PAYOUT_TOKEN` (tous fail-closed).
- `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`.
- `CORS_ORIGIN` (origines exactes autorisées).

## Déploiement
1. Pousser sur `main` (Render redéploie automatiquement la prod). Ne **pas** déployer de feature branche sur `main`.
2. Vérifier la CI verte puis `/api/v1/health/ready`.
3. Vérifier `PAYMENT_PROVIDER`, `PAYMENT_ENV` (sandbox/live) selon l'objectif.

## Monitoring / alertes
- Sentry (`SENTRY_DSN`) pour les erreurs applicatives.
- Logs structurés via logger Nest.
- Sur échec de paiement/escrow : erreurs `[Holding Cron]`, `[Payout Failed]` à surveiller.
