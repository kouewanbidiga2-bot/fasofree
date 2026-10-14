# FasoFree — Carte du projet (digest d'immersion)

> Digest produit après lecture complète du dépôt (clone GitHub `origin/main`, HEAD `7640a691`).
> Représente l'état **committé** sur GitHub, pas les modifications locales non commitées.

---

## 1. Vue d'ensemble

Super-app burkinabè de **livraison de repas, courses (rides) et envoi de colis (P2P)** mono-repo à 3 applis :

| App | Stack | Déploiement |
|---|---|---|
| `fasofree-backend` | NestJS 11 + TypeORM + PostgreSQL (Neon) + Redis (Upstash) + Socket.IO | Render (Docker, `render.yaml`) — `api.fasofree.site` / `fasofree-3nh8.onrender.com` |
| `fasofree-frontend` | React + Vite + Zustand (dashboard admin) | Vercel — `admin.fasofree.site` |
| `fasofree-frontend-client` | React + Vite + Zustand (app client) | Vercel — `fasofree.site` |

Rôles : `CLIENT`, `MERCHANT`, `DRIVER` (courier/livreur), `BUSINESS_ADMIN`, `ADMIN`, `SUPER_ADMIN`, `SUPPORT`.
Paiement : **GeniusPay uniquement** (Wave, Orange Money, Moov Money, Telecel). Notifications : FCM push + Email + WhatsApp (Meta Cloud API) + SMS (Twilio/Africa's Talking/fallback local).

---

## 2. Backend (`fasofree-backend`) — 152 routes sous `/api/v1`

### 2.1 Socle technique
- `main.ts` : fail-fast en prod si `JWT_SECRET`/`DATABASE_URL` absents ; préfixe `/api/v1` ; Swagger `/api/docs` ; CORS strict (origines exactes + patterns `*.fasofree.site`/`*.vercel.app`/`*.onrender.com`).
- `config/database.config.ts` : `synchronize` **toujours désactivé en prod** (imposé par le code) ; migrations au boot via `DB_MIGRATIONS_RUN`.
- `core/redis` : présence Redis type Upstash (cache, verrous, Geo pour dispatch).
- `core/security` : `RolesGuard`, décorateurs `@Roles`, `ThrottlerGuard`.
- `common/filters` : gestion d'erreurs ; `sentry.init.ts` ; `cli.ts` (nestjs-command, seed).
- **37 migrations TypeORM** additives dans `src/database/migrations/` (wallets → p2p → dispatch → KYC → disputes → fintech hybride → tiers → abonnements → ban → etc.).

### 2.2 Modules métier (les plus importants)

- **Auth** (`modules/auth`) : register (rôle par défaut CLIENT), login, OTP, candidature marchand/livreur (multipart), KYC dédié, stratégie JWT, v1/v2 flows.
- **Orders** (`modules/orders`) — cœur du système (~2557 lignes) :
  - **FSM stricte** de statuts avec `nonOverridableStatuses` ; statuts riches : `PENDING → CONFIRMED → PREPARING → READY → READY_FOR_PICKUP → DRIVER_ASSIGNED → OUT_FOR_DELIVERY → DELIVERED_PENDING_CONFIRMATION → DELIVERED`, `COMPLETED`, `CANCELLED`, `PAID`, `AWAITING_PAYMENT`, ride (`REQUESTED/ACCEPTED/PICKUP/…`).
  - Types : `DELIVERY`, `PICKUP`, `DINE_IN`, `P2P`, `RIDE`.
  - **Delivery pricing** (`delivery-pricing.service`) : tranches 1500–4000 FCFA + **surcharge nuit 500 FCFA (21h–06h Africa/Ouagadougou)** + tiers depuis DB (`SystemSettings.deliveryTiers`).
  - **Ride pricing** (`services/ride-pricing.service`) : ECON/COMFORT/PREMIUM ×1/×1.4/×2, plancher 1000 FCFA ; `distance-calculator` Haversine avec fallback.
  - **Escrow 3h** : hold → release, idempotent, cron restart-safe.
  - **Code PIN de livraison** (validation client et driver).
  - Notifications par statut ; localisation live du livreur ; traces `order_dispatch_traces`.
- **GeoDispatch** (`dispatch`) : scoring **distance 60% / rating 40%**, `MAX_DISTANCE_KM=10`, `MIN_RATING=3.0`, vélo max 3 km ; Redis Geo + traces ; gateway Socket.IO (`/dispatch`) CORS allowlist ; handlers Location/Room.
- **Payments** (`payments`) : GeniusPay payin/checkout/verify, **webhooks HMAC fail-closed** (canonique `${ref}:${orderId}:${amount}:${timestamp}`, `PAYMENT_WEBHOOK_SECRET`), validation montant (tolérance 1 FCFA) ; `payouts.service` anti-double-payout : **UNIQUE sur `merchant_payouts.orderId`**, `PROCESSING` jamais re-run (réconciliation), réclamation atomique du retry.
- **Wallets** (`wallets`) : `wallet.service` ~1131 lignes — verrous `pessimistic_write`, hold/release/confirm ATF, crons `calculateAvailablePayouts` ; ledger `WalletTransaction` (idempotence `(walletId, reference, reason)`) ; controller admin (payouts SUPER_ADMIN).
- **Financial** (`financial`) : modèle **hybride** — `order-pricing.service` (`DELIVERY_FEE = max(GPS, MIN 800)`, serviceFee 100 FCFA offert VIP, commission marchand **5% Starter / 1.5% Boost Pro**) ; `merchant-financial.service` (settlement à `COMPLETED`, `merchantPayoutAmount`, pas de double débit) ; `driver-financial.service` (crédit à `DELIVERED`, **Daily Pass 500 FCFA au 1er ride/jour**, sinon micro-commission 1%).
- **Notifications** (`notifications`) : **dispatcher multi-canaux** `sendNotification()` (EMAIL→SMS fallback + FCM parallèle) ; `notification-store` (table `notifications` lues via `/notifications`) ; providers Twilio/Africa's Talking/fallback (`SMS_PROVIDER`), Gmail SMTP + Resend fallback, WhatsApp webhook Meta (HMAC fail-closed, TOKEN GET + App Secret POST).
- **Subscriptions** (`subscriptions`) : plans Starter/Boost Pro, `MERCHANT_COMMISSION_RATES` (0.05 / 0.015), `SERVICE_FEE_DEFAULT=100`, `MIN_MERCHANT_PLAN_PRICE=5000`, cache plan ; souscription VIP client.
- **Disputes** : `OPEN → INVESTIGATION → PENDING_ADMIN_APPROVAL → APPROVED` (remboursement via wallet) / `REJECTED`.
- **Loyalty** (`loyalty`) : 1 pt / 100 FCFA, exp 12 mois ; parrainage +500 / +200.
- **Promotions** (`promotions`) : codes promos par business, parrainage `USER_REGISTERED` → crédit wallet.
- **Stories** : stories par business (24h), vues, likes, story fee (migration).
- **Chat** : chat éphémère commande (`order_chat_{orderId}_{channel}`, channels merchant/driver/client) + **internal-chat** (équipe, DM, canaux par rôle) via Socket.IO (`/chat`, `/internal-chat`).
- **Analytics** (`analytics`) : stats marchand (CA, net, commission, top produits, alerte stock bas) ; `COMMISSION_RATE` (⚠️ constante 0.15 configurable).
- **KYC** : documents (CNI, permis, carte grise), statuts, review ADMIN/SUPPORT, resoumission après refus.
- **Upload** : driver abstrait **Cloudinary → S3 → local** (upload image/multipart 5 Mo), private uploads KYC.
- **Divers** : `addresses` (adresses utilisateur + défaut), `brands` (marques multi-agences), `businesses` (multi-agence, GeoJSON `[lon,lat]`, `findAllByOwner`), `products` (SKU, stock, alerte bas), `otp`, `onboarding`, `tracking` (distance Google Maps + calcul frais), `receipts` (numéros `RC-YYYYMMDD-XXXX`, retry concurrence), `settings` (singleton : tiers livraison + sync caches statiques), `seed` (données de test idempotentes), `health` (liveness/readiness/DB ping), `users` (ban/ban-request, `ensureMasterSuperAdmin` idempotent).

### 2.3 Sécurité / fiabilité (documentée dans `docs/SECURITY.md`)
- **Fail-closed partout** : webhook sans secret → rejet ; secret JWT absent → refus de boot en prod.
- Anti-faux-paiement : authentification + **validation du montant** de chaque webhook.
- Anti-double-payout : UNIQUE `orderId`, réclamation atomique, `PROCESSING` → réconciliation.
- CORS strict en prod ; rate limiting (throttler) ; `check:secrets` en CI.

---

## 3. Dashboard admin (`fasofree-frontend`)

- SPA Vite + Zustand (`useAuthStore`), intercepteur Axios (JWT `fasofree_token`, auto-logout 401).
- **`dashboard/SuperAdminDashboard.jsx`** (2803 l.) : plateforme complète — vue financière globale, gestion admins/plans d'abonnement, paramètres plateforme, validation/blocage marchands-livreurs, KYC pending, disputes, marques, ban requests.
- **`BusinessAdminDashboard.jsx`** (1510 l.) : inventaire multi-entités SKU, stock avec décréments auto, variantes, alertes stock bas, gestion commandes FSM temps réel, analytics ventes, wallet, switch de branches (marque multi-agences).
- **`DriverDashboard.jsx`** (1130 l.) : jobs disponibles (`/dispatch/available`), accept/refuse, avancement statuts, statut en ligne/offline, gains journaliers/hebdo/mensuel, historique, chat client-livreur.
- **`SupportDashboard.jsx`** (821 l.) : stats plateforme (sans données financières), file KYC, disputes, ban requests, inbox des chats de commande (lecture), internal-chat équipe.
- **`AdminManagerDashboard.jsx`** (707 l.) : gestion des comptes admin/support.
- **`ApplicationsDashboard`**, **`LiveOrders`** : candidatures marchand/livreur, flux live des commandes.
- Services admin : `orderService`, `inventoryService`, `walletService`, `financialService` (dashboard financier, money flows, brand breakdown), `disputeService`, `kycService`, `subscriptionService`, `usersService` (ban requests), `promotionService`, `analyticsService`, `onboardingService`, `realtime` (sockets avec **re-token frais à chaque reconnexion**).

---

## 4. App client (`fasofree-frontend-client`)

- **Bilingue FR/EN** (`contexts/LanguageContext.jsx` ~1022 l.) + dark mode (`DarkModeContext`).
- Store Zustand : `authStore` (loginOtp, token, premium, `needsVerification`), `cartStore` (panier mono-restaurant), `notificationStore` (optimistic read/unread).
- Pages clés :
  - **`Register.jsx`** (704 l.) : 3 onglets Client/Marchand/Livreur, candidature pro (marchand avec business + géoloc, livreur avec véhicule + KYC), parrainage.
  - **`OrderTracking.jsx`** (736 l.) : stepper statuts (food vs ride), map Leaflet temps réel, PIN de livraison, chat, dispute modal.
  - **`Checkout.jsx`** (600 l.) : fulfillment DELIVERY/PICKUP/DINE_IN, devis (`fetchQuote`), paiement GeniusPay.
  - **`Restaurant.jsx`** (510 l.) : menu par catégorie, favoris, **commande vocale** (Web Speech → ajout auto au panier), marques multi-agences (sélecteur de branches).
  - `P2PDelivery` (colis), `RideBooking` (rides ECON/COMFORT/PREMIUM), `Merchant*` (dashboard marchand dans l'app client : produits, commandes, wallet, settings), `VipPass` (abonnement), `Receipt`, `Disputes`, `Addresses`, `Orders`, `Profile`, `Auth`, `VerifyAccount`, `Search`, `Terms`/`Privacy`.
- `services/firebase.js` + `public/firebase-messaging-sw.js` : FCM foreground + background push avec deep-link `/order-tracking?id=…`.
- `services/pricingService.js` : quote frais livraison (min 800 FCFA, VIP = 0 service fee).

---

## 5. Docs, déploiement & tests

- **`RAPPORT_TECHNIQUE.md`** : référence technique vivante (v5.0.0, 152 routes, historique des fixes, « Erreurs restantes »). `PROJECT_BIBLE.md` : **obsolète**.
- **`docs/`** : `CI_CD.md`, `DISASTER_RECOVERY.md` (RPO minutes / RTO <15min, PITR Neon, procédure payout PROCESSING, checklist redéploiement), `ENVIRONMENT_VARIABLES.md`, `PRODUCTION.md`, `SECURITY.md`.
- **`render.yaml`** : blueprint Render — seulement le backend Docker (`fasofree-api`) ; frontends sur Vercel ; healthcheck `/api/v1/health/ready` ; `DB_MIGRATIONS_RUN=true`, synchronize interdit.
- **`.github/workflows/ci.yml`** : gate backend (secrets, tsc, build, test ; lint non bloquant — dette ~772 erreurs prettier connue) + builds frontends ; `concurrency.cancel-in-progress`.
- **`k6-tests/`** : `load-test.js` multi-scénarios (browse 200 VU, order 80 VU, driver 10 VU, admin 5 VU), seuils `p(95)<5000ms`.
- **`.env.example`** : placeholders uniquement (aucun secret) — JWT ≥32 car., Neon, Upstash, GeniusPay, Cloudinary/S3, Firebase, WhatsApp, SMS.

---

## 6. Points d'attention / dette connue

1. **Notifications commandes & disputes (ordre GitHub)** : `orders.service.ts` envoie encore en direct `sendToDevice` (token-gated) au lieu du dispatcher multi-canaux ; remboursement dispute aussi. → **corrigé en local, non committé** (voir section 7).
2. **Dette lint** : ~772 erreurs prettier non bloquantes en CI.
3. `analytics.service.ts` : `COMMISSION_RATE = 0.15` en dur — à aligner sur `MERCHANT_COMMISSION_RATES`.
4. `tracking.service.ts` : frais simpliste (`max(500, baseFee)`) — le vrai modèle est dans `order-pricing.service`.
5. `PROJECT_BIBLE.md` obsolète face à `RAPPORT_TECHNIQUE.md`.

---

## 7. État local vs GitHub (différences non commitées)

Changes non commités dans le workspace (à ne **pas** confondre avec `origin/main`) :
- **Fix notifications (5 fichiers à committer) :** `notifications.service.ts`, `orders.service.ts` (`sendStatusNotifications` routé via dispatcher), `disputes.service.ts` (refund via dispatcher), `.env.example`, `docs/ENVIRONMENT_VARIABLES.md`.
- **Non liés** : `email.service.ts`, `subscriptions/*`, `wallets/entities/wallet-transaction.entity.ts`, `swagger-spec.json`, `fasofree-frontend-client/*` (Footer, Privacy), migration `add-story-fee`, + untracked (videos, deploy/, specs AD/TikTok, figures Lab1…).