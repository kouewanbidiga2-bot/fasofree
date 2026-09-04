# Sécurité — FasoFree Backend

## Principes appliqués
- **Fail-closed** : en cas de doute (secret manquant, signature absente), le traitement est **rejeté**, jamais exécuté.
- **Aucun secret codé en dur** : plus aucun fallback secret dans le code (JWT, WhatsApp). `.env.example` ne contient que des placeholders.
- **Validation de config au démarrage** : en prod, `JWT_SECRET` et `DATABASE_URL` manquants → démarrage refusé (`main.ts` → `validateCriticalConfig`).

## Webhooks de paiement (anti-faux-paiement)
Chaque tunnel vérifie **l'authenticité** puis le **montant** avant de marquer une commande payée :

| Provider | Authentification | Montant validé ? |
|---|---|---|
| **PayDunya** | Hash `SHA-512(masterKey)` comparé en `timingSafeEqual` ; secret absent → rejeté | ✅ |
| **YengaPay** | HMAC-SHA256 (`x-webhook-hash`) en `timingSafeEqual` ; secret ou en-tête absent → rejeté | ✅ |
| **Wave** | `WaveWebhookGuard` (HMAC + `timingSafeEqual`) | ✅ |
| **LigdiCash** | Jeton hash ; jeton absent/non configuré → rejeté | ✅ |

`validatePaymentAmount` (tolérance 1 FCFA vs `order.totalAmount`) bloque tout montant falsifié.

## Anti-double-paiement (escrow 3h)
La libération des fonds (`releaseHeldPayouts`) suit une machine à états stricte :
- `escrow due → payout UNIQUE → processing → SUCCESS confirmé → payoutReleased=true`
- échec certain (`FAILED`) → **retry** ; état inconnu (`PROCESSING`) → **pas de 2e payout**, réconciliation.
- Implémentation :
  - **Index UNIQUE** sur `merchant_payouts.orderId` (entité + migration `…1725200000000`) : deux instances ne peuvent pas insérer deux paieouts.
  - **Réclamation atomique** du retry (`claimAndExecute`, `UPDATE … WHERE status IN (FAILED,PENDING)`) : un seul gagnant exécute le virement.
  - `creditWallet` : garde d'idempotence transactionnelle (même wallet + référence + raison → ignoré).

## HTTP
- **CORS** : en production, toute origine hors `CORS_ORIGIN` / patterns `*.fasofree.site`, `*.vercel.app`, `*.onrender.com` est **rejetée** (`callback(new Error(...))`). (Correction du bug `callback(null, true)` qui autorisait tout.)
- **Helmet** + **rate limiting** (`@nestjs/throttler`, global) avec seuils configurés par `THROTTLE_TTL_MS` / `THROTTLE_LIMIT`.
- **JWT** : secret centralisé (`resolveJwtSecret`) — HTTP et WebSocket utilisent la même clé.

## Routes sensibles
- `/balance`, `/account`, `/payments`, `/payment/:ref`, `/paydunya/test-config` restreints à `admin`/`support` (payload relâchés, clés masquées).
- Analyse : `getBusinessOverview` vérifie la propriété du commerce (`brand.ownerId`).

## Webhook WhatsApp (Meta)
- `GET` : vérification du `WHATSAPP_VERIFY_TOKEN` (aucun défaut codé en dur).
- `POST` : vérification de **`X-Hub-Signature-256`** (HMAC-SHA256 du corps brut via `WHATSAPP_APP_SECRET`). Signature invalide ou absente → `401`.

## Bonnes pratiques
- Ne jamais committer `.env` / `.env.local` (CI `check:secrets` le bloque).
- Rotation des secrets via Render (dashboard → Environment), valeurs `sync: false` dans `render.yaml`.
