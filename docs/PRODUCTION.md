# Production — FasoFree Backend

## Architecture
- **Monolithe modulaire** NestJS (API `/api/v1`) + PostgreSQL (Neon) + Redis (Upstash).
- Déploiement : **Render** (`render.yaml`) pour le backend (Docker), **Vercel** pour les frontends.

## Base de données : migrations vs synchronize
- **`synchronize` est interdit en production** (imposé dans `database.config.ts`, la surcharge `DB_SYNCHRONIZE` y est ignorée).
- Le schéma est géré par les **migrations** TypeORM : `DB_MIGRATIONS_RUN=true` (voir `render.yaml`).
- Les migrations vivent dans `fasofree-backend/src/database/migrations/`. Les commandes :
  ```bash
  # générer une migration après modif d'entités
  npx typeorm migration:generate src/database/migrations/<Timestamp>-<name> -d dist/database/database.config.js
  # lancer manuellement
  npx ts-node -r tsconfig-paths/register node_modules/typeorm/cli.js migration:run -d src/database/database.config.ts
  ```
  > ⚠️ Les migrations doivent être **additives** (`IF NOT EXISTS`) : la base prod existante a été créée historiquement via `synchronize`.

## Santé / redémarrage
- `GET /api/v1/health/live` — liveness (l'instance est vivante, sans dépendance DB).
- `GET /api/v1/health/ready` — readiness (ping base de données). Le healthcheck Render pointe ici.

## Variables d'environnement essentielles
Voir `.env.example`. Essentiel :
- `JWT_SECRET`, `DATABASE_URL` (fail-fast si absents).
- `GENIUSPAY_API_KEY`, `GENIUSPAY_API_SECRET`, `GENIUSPAY_WEBHOOK_SECRET` (fail-closed).
- `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`.
- `CORS_ORIGIN` (origines exactes autorisées).

## Déploiement
1. Pousser sur `main` (Render redéploie automatiquement). Ne **pas** déployer de feature branche sur `main`.
2. Vérifier la CI verte puis `/api/v1/health/ready`.
3. Vérifier `PAYMENT_ENV` (sandbox/live) selon l'objectif.

## Monitoring / alertes
- Sentry (`SENTRY_DSN`) pour les erreurs applicatives.
- Logs structurés via logger Nest.
- Sur échec de paiement/escrow : erreurs `[Holding Cron]`, `[Payout Failed]` à surveiller.
