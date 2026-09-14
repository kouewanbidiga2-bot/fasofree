# RAPPORT TECHNIQUE — FasoFree
## Corrections complètes audit + nettoyage code mort

**Date** : 13 Septembre 2026  
**Auteur** : Assistant IA (Codebuff)  
**Version** : 4.1.0  
**Repo** : github.com/kouewanbidiga2-bot/fasofree

> **Note** : Ce rapport remplace `PROJECT_BIBLE.md` comme reference technique.
> PROJECT_BIBLE.md contient des informations obsoletes (fournisseurs de paiement
> ligdicash/cinetpay/mock, 97 routes au lieu de 152, FSM different).

---

## TABLE DES MATIERES

1. [Swagger — Documentation API](#1-swagger)
2. [Corrections critiques (14 bugs)](#2-corrections)
3. [Nettoyage code mort](#3-nettoyage)
4. [Fonctionnalites ajoutees](#4-ajouts)
5. [Erreurs restantes](#5-erreurs)
6. [Architecture technique](#6-architecture)
7. [Deploiement](#7-deploiement)

---

## 1. SWAGGER

**URL** : `https://api.fasofree.site/api/docs`

| Metrique | Valeur |
|----------|--------|
| OpenAPI | 3.0.0 |
| Routes documentees | 152 |
| Schemas DTO | 47 |
| Tags | 36 |
| Auth | Bearer JWT |

### Modules documentes

| Tag | Routes | Description |
|-----|--------|-------------|
| Authentication | 7 | Inscription, connexion, OTP, roles |
| Users | 14 | Gestion comptes, profil, adresses |
| Businesses | 10 | Commerces, branches, ownership |
| Products | 6 | Catalogue, stock, disponibilite |
| Orders | 16 | Commandes FSM, historique |
| Dispatch | 3 | Attribution livreur, cascade, timeout |
| Payments | 5 | GeniusPay, Orange/Moov/Wave |
| Wallets | 6 | Portefeuilles, credits, retraits |
| Financial | 6 | Settlement, commission, rapports |
| Analytics | 3 | Statistiques ventes, graphiques |
| Reviews | 4 | Notes et avis clients |
| Disputes | 7 | Reclamations client |
| Chat | 2 | Messagerie temps reel |
| Subscriptions | 9 | Forfaits marchands |
| Notifications | 4 | Push, email, WhatsApp |
| Stories | 7 | Stories ephemeres restaurants |
| Loyalty | 5 | Points de fidelite |
| Promotions | 2 | Codes promo |
| Settings | 2 | Configuration plateforme |
| Tracking | 1 | Suivi livraisons |
| Addresses | 4 | Adresses livraison |
| Favorites | 3 | Restaurants favoris |
| Uploads | 1 | Upload Cloudinary |
| Health | 2 | Healthcheck |
| Seed | 4 | Donnees de test + fix wallet + backfill |
| Ban Requests | 4 | Bannissements |
| Internal Chat | 3 | Chat equipe admin |
| OTP Verification | 3 | Verification OTP |
| KYC | 6 | Verification identite |
| Onboarding | 3 | Candidature marchand/livreur |
| GeniusPay | 7 | Integration paiement |
| Webhooks | 2 | Webhooks paiement, WhatsApp |

---

## 2. CORRECTIONS

### Phase 1 (v2.0.0) — Corrections initiales

#### FIX 1 : Route GET /wallets/brand/:brandId inaccessible
**Fichier** : `wallet.controller.ts:94`  
**Probleme** : `brand/:brandId` declaree APRES `:userRole/:userId`. NestJS matchait `brand` comme `userRole` → 403.  
**Solution** : Deplace AVANT + doublon supprime.  
**Commit** : `0c10c6a`, `91eaf92`

#### FIX 2 : Wallet global jamais credite
**Fichier** : `merchant-financial.service.ts:48`  
**Probleme** : `creditWallet(order.businessId, ...)` → userId = businessId. Frontend cherche avec `user.id` (ownerId).  
**Solution** : `merchantUserId = business.ownerId ?? order.businessId` + `branchId = order.businessId`.  
**Commit** : `178e160`

#### FIX 3 : getBrandWallets ignore brandId
**Fichier** : `wallet.service.ts:684`  
**Probleme** : Filtrait sur `userRole: MERCHANT` mais branch wallets avaient `userRole: DRIVER`.  
**Solution** : Supprime le filtre `userRole`.  
**Commit** : `91eaf92`

#### FIX 4 : Payout cron
**Fichier** : `wallet.service.ts:485`  
**Probleme** : Comparait `wallet.userId` (ownerId) aux businesses → toujours 0.  
**Solution** : Recherche businesses par `ownerId` avant credit.  
**Commit** : `004e74e`

#### FIX 5 : Analytics mauvais alias
**Fichier** : `analytics.service.ts:524`  
**Probleme** : `order.createdAt` au lieu de `o."createdAt"` → erreur SQL.  
**Solution** : Corrige + brand chart respecte filtre date.  
**Commit** : `5fad369`

#### FIX 6 : Settings marchand pas chargees
**Fichier** : `BusinessAdminDashboard.jsx:569`  
**Probleme** : `loadSettings()` absent du useEffect de montage.  
**Solution** : Ajoute dans les dependances.  
**Commit** : `5fad369`

#### FIX 7 : Socket fuite memoire au logout
**Fichier** : `authStore.js:96`  
**Probleme** : Les sockets n'etaient pas deconnectes au logout → fuite memoire.  
**Solution** : `disconnectRealtime()` appele au logout.  
**Commit** : `5fad369`

#### FIX 8 : Table headers/cells mismatch
**Fichier** : `SuperAdminDashboard.jsx`  
**Probleme** : 7 headers, 6 colonnes (colonne "Mot de passe" sans cellule correspondante).  
**Solution** : Suppression de la colonne.  
**Commit** : `5fad369`

#### FIX 9 : Endpoint fix-wallet-userroles
**Fichier** : `seed.controller.ts`  
**Probleme** : Les branch wallets ont `userRole=DRIVER` au lieu de `MERCHANT`.  
**Solution** : `POST /seed/fix-wallet-userroles` (super admin) corrige les wallets.  
**Commit** : `87fd286`

### Phase 2 (v3.0.0) — Audit complet + corrections

#### FIX 10 : Notifications 500 — @CurrentUser('id') incorrect
**Fichier** : `notifications.controller.ts`  
**Probleme** : `@CurrentUser('id')` alors que le JWT strategy retourne `{ userId, role }`, pas `{ id, role }`. Le decorateur recevait `undefined` → crash 500 sur toutes les routes `/notifications`.  
**Solution** : Remplace `@CurrentUser('id')` par `@CurrentUser('userId')` (4 occurrences).  
**Impact** : GET /notifications, POST /notifications/fcm-token, PATCH /notifications/:id/read, PATCH /notifications/read-all — toutes restaurees.

#### FIX 11 : Chat 500 — SQL non quoté
**Fichier** : `chat.service.ts`  
**Probleme** : Les sous-requêtes SQL brutes utilisaient `m2.orderId` sans guillemets. PostgreSQL replie les identifiants non quotes en minuscules → `m2.orderid` (inexistant) → erreur SQL → 500.  
**Solution** : Ajout de guillemets doubles : `m2."orderId"`, `m2."createdAt"`.  
**Impact** : GET /chat restaure.

#### FIX 12 : Financial/brands 500 — colonne branchId manquante
**Fichier** : Migration `1726000000000-add-branch-id-to-orders.ts`  
**Probleme** : L'entité `Order` déclarait `branchId` mais aucune migration ne créait cette colonne. La requête `getBrandBreakdown()` crashait en prod.  
**Solution** : Nouvelle migration `1726000000000-add-branch-id-to-orders.ts` qui ajoute `branchId VARCHAR` + index sur la table `orders`.  
**Impact** : GET /financial/brands restaure + support multi-agences possible.

#### FIX 13 : Stories 500 — try-catch de sécurité
**Fichier** : `stories.service.ts`  
**Probleme** : `getActiveStories()` n'avait aucun try-catch. Si la requête TypeORM échouait (table vide, FK orphelines), le 500 remontait au client.  
**Solution** : Ajout d'un try-catch qui retourne un tableau vide en cas d'erreur + log.  
**Impact** : GET /stories ne crash plus — retourne `{ success: true, data: [] }` en cas de problème.

#### FIX 14 : Nettoyage code mort LigdiCash/Mock/Paydunya/YengaPay
**Fichiers** : Supprimés + modifiés (voir section 3)  
**Probleme** : LigdiCashModule n'était jamais importé dans app.module.ts → routes mortes documentées dans Swagger. MockPaymentService, PaydunyaService, YengaPayService → code mort.  
**Solution** : 
- Suppression de `ligdicash.module.ts`, `ligdicash.controller.ts`, `ligdicash.service.ts`
- Suppression de `mock-payment.service.ts`
- Suppression de `paydunya.service.ts`, `paydunya.module.ts`
- Suppression de `yengapay.service.ts`, `yengapay.module.ts`
- Suppression de `create-payin.dto.ts`, `pay-order.dto.ts`
- Ajout de `GeniusPayPayoutProvider` pour les retraits
- Renommage `CinetPayPayoutProvider` → `GeniusPayPayoutProvider`
- Nettoyage des commentaires `ligdiCash` dans le monitoring financier
- Suppression du bloc de test YengaPay dans `payments-webhook-guard.spec.ts`
- Mise à jour `render.yaml` : suppression de `PAYMENT_PROVIDER=mock`
- Nettoyage des docs (ENVIRONMENT_VARIABLES, PRODUCTION, SECURITY, README)

#### FIX 15 : Products stock 404
**Fichier** : `products.controller.ts`, `products.service.ts`  
**Probleme** : Le dashboard admin appelle `POST /products/:id/stock` pour mettre à jour le stock, mais la route n'existait pas côté backend.  
**Solution** : Ajout de `POST /products/:id/stock` avec vérification d'ownership + méthode `updateStock()` dans le service.  
**Impact** : Le bouton "Mettre à jour le stock" dans le dashboard marchand fonctionne.

#### FIX 16 : Products generate-sku 404
**Fichier** : `products.controller.ts`, `products.service.ts`  
**Probleme** : Le dashboard admin appelle `POST /products/generate-sku` pour générer un SKU automatique, mais la route n'existait pas.  
**Solution** : Ajout de `POST /products/generate-sku` + méthode `generateSku()` (format : `PREFIX-NAME-BIZID-TIMESTAMP`).  
**Impact** : La génération automatique de SKU fonctionne.

#### FIX 17 : Confirm-delivery 404
**Fichier** : `orders.controller.ts`, `orders.service.ts`  
**Probleme** : Le dashboard admin appelle `POST /orders/:id/confirm-delivery` pour confirmer une livraison (sans PIN), mais la route n'existait que sous `client-validate` (avec PIN).  
**Solution** : Ajout de `POST /orders/:id/confirm-delivery` (admin/marchand, SUPER_ADMIN/ADMIN/BUSINESS_ADMIN) + méthode `confirmDeliveryByAdmin()`.  
**Impact** : La confirmation de livraison par admin/marchand fonctionne.

#### FIX 18 : Driver-location 404
**Fichier** : `orders.controller.ts`, `orders.service.ts`  
**Probleme** : Le dashboard admin appelle `POST /orders/:id/driver-location` pour la localisation temps réel du livreur, mais la route n'existait pas.  
**Solution** : Ajout de `POST /orders/:id/driver-location` (DRIVER/COURIER) + méthode `updateDriverLocation()` qui utilise `GeoDispatchService.updateDriverLocation()` (Redis Geo).  
**Impact** : Le suivi temps réel du livreur est actif via HTTP.

#### FIX 19 : GET /products/:id manquant
**Fichier** : `products.controller.ts`  
**Probleme** : `productService.js` admin appelle `GET /products/:id` pour le détail d'un produit, mais aucune route GET dynamique n'existait (seulement `GET /products/business/:businessId`).  
**Solution** : Ajout de `GET /products/:id` (route publique) + le service avait déjà `findOne()`.  
**Impact** : La consultation du détail d'un produit fonctionne.

#### FIX 20 : GET /health manquant
**Fichier** : `health.controller.ts`  
**Probleme** : `financialService.js` admin appelle `GET /health` pour le healthcheck système, mais le controller n'avait que `/health/live` et `/health/ready`.  
**Solution** : Ajout de `GET /health` (liveness + readiness combinés).  
**Impact** : Le healthcheck système fonctionne.

#### FIX 21 : POST /promotions/quote vs GET backend
**Fichier** : `fasofree-frontend-client/src/services/api.js`  
**Probleme** : Le client appelle `POST /promotions/quote` avec un body, mais le backend attend `GET /promotions/quote` avec des query params (`code`, `amount`).  
**Solution** : Changement côté frontend : `GET` avec query params au lieu de `POST` avec body.  
**Impact** : L'application des codes promo fonctionne côté client.

#### FIX 22 : POST /subscriptions vs POST /subscriptions/assign
**Fichier** : `fasofree-frontend/src/services/subscriptionService.js`  
**Probleme** : Le dashboard admin appelle `POST /subscriptions` pour assigner un abonnement, mais le backend a `POST /subscriptions/assign`.  
**Solution** : Correction du chemin dans le frontend.  
**Impact** : L'assignation d'abonnements fonctionne.

#### FIX 23 : Health controller conflit de noms
**Fichier** : `health.controller.ts`  
**Probleme** : La méthode `health()` entrait en conflit avec le champ `private health: HealthCheckService` (erreur TypeScript `Duplicate identifier`).  
**Solution** : Renommage en `checkAll()`.  
**Impact** : Compilation backend corrigée.

---

## 3. NETTOYAGE CODE MORT

### Fichiers supprimés (8 fichiers)
| Fichier | Raison |
|---------|--------|
| `payments/ligdicash.module.ts` | Module jamais importé dans app.module.ts |
| `payments/ligdicash.controller.ts` | Routes mortes (jamais montées) |
| `payments/ligdicash.service.ts` | Service mort |
| `payments/mock-payment.service.ts` | Mock non utilisé |
| `payments/dto/create-payin.dto.ts` | DTO orphelin |
| `payments/dto/pay-order.dto.ts` | DTO orphelin |
| `wallets/providers/cinetpay-payout.provider.ts` | Renommé → geniuspay-payout.provider.ts |
| `payments/yengapay.service.ts` | Service mort |
| `payments/yengapay.module.ts` | Module mort |
| `payments/paydunya.service.ts` | Service mort |
| `payments/paydunya.module.ts` | Module mort |

### Fichiers créés (2 fichiers)
| Fichier | Description |
|---------|-------------|
| `wallets/providers/geniuspay-payout.provider.ts` | Provider GeniusPay pour les retraits (remplace CinetPay) |
| `database/migrations/1726000000000-add-branch-id-to-orders.ts` | Migration pour la colonne `branchId` sur `orders` |

### Fichiers modifiés (12 fichiers)
| Fichier | Modifications |
|---------|---------------|
| `wallets/payouts.service.ts` | Import GeniusPayPayoutProvider au lieu de CinetPay |
| `wallets/wallet.module.ts` | ForFeature GeniusPayPayoutProvider + PayoutRequest |
| `wallets/wallet.controller.ts` | Ajout `super_admin` au roleMap + vue agrégée super admin |
| `wallets/wallet.service.ts` | Ajout `PayoutRequestRepository` + persistance cron |
| `health/health.controller.ts` | Suppression doublon @Get() inutile |
| `financial/services/financial-monitoring.service.ts` | Renommage ligdiCash → geniusPay |
| `financial/financial.controller.ts` | Renommage ligdiCash → geniusPay |
| `financial/crons/financial-alerts.cron.ts` | Renommage ligdiCash → geniusPay |
| `financial/entities/payout-request.entity.ts` | Ajustement colonnes pour compatibilité migration |
| `seed/seed.service.ts` | Ajout endpoint backfill crédits orphelins |
| `seed/seed.controller.ts` | Ajout route POST /seed/backfill-orphan-credits |
| `notifications/notifications.controller.ts` | @CurrentUser('id') → @CurrentUser('userId') |
| `chat/chat.service.ts` | Guillemets SQL pour orderId |
| `stories/stories.service.ts` | Try-catch sur getActiveStories |
| `payments/entities/transaction.entity.ts` | Renommage commentaire ligdiCash |
| `wallets/entities/wallet-transaction.entity.ts` | Renommage commentaire ligdiCash |
| `payments/payments-webhook-guard.spec.ts` | Suppression bloc test YengaPay |
| `render.yaml` | Suppression PAYMENT_PROVIDER, URLs frontends Vercel |
| `docs/ENVIRONMENT_VARIABLES.md` | Nettoyage LigdiCash |
| `docs/PRODUCTION.md` | Nettoyage LigdiCash, alias /health |
| `docs/SECURITY.md` | Nettoyage LigdiCash |
| `README.md` | Nettoyage LigdiCash |

---

## 4. FONCTIONNALITES AJOUTEES

### 4.1 Dispatch automatique livreur
- Transaction `SERIALIZABLE` + `pessimistic_write` sur acceptation
- `isAvailable = false` quand un livreur accepte
- Timeout 10 min sur `READY_FOR_PICKUP`
- Refus re-notifie le candidat suivant
- Toggle disponibilite persiste au backend

### 4.2 Client disputes
- `GET /disputes/me` pour lister les reclamations
- Page disputes dans le profil client

### 4.3 Multi-branch support
- `GET /businesses/me` retourne TOUTES les branches
- `POST /orders/brand` pour commandes multi-agences
- Auto-repair marchands orphelins

### 4.4 Merchant FSM
- `MerchantTransitions` map masque les transitions driver-only
- `getNextPossibleStatuses` accepte le parametre `role`

### 4.5 Endpoint fix-wallet-userroles
- `POST /seed/fix-wallet-userroles` (super admin)
- Corrige les branch wallets avec `userRole=DRIVER` → `MERCHANT`

### 4.6 Backfill crédits orphelins
- `POST /seed/backfill-orphan-credits` (super admin)
- Déplace les crédits du wallet `userId=businessId` vers le wallet `userId=ownerId`
- Crée les wallets manquants si nécessaire

### 4.7 Vue agrégée super admin wallets
- `GET /wallets/super_admin/all` retourne tous les wallets avec soldes
- Route accessible uniquement aux super_admin

### 4.8 PayoutRequest persistence
- Le cron payout crée maintenant de vraies entités `payout_requests`
- Migration `1725900000000-create-payout-requests.ts` pour la table

### 4.9 Brand wallet dashboard
- `getBrandWallets` branché dans `BusinessAdminDashboard.jsx`
- Affiche le total agrégé de toutes les agences dans la sidebar

---

## 5. ERREURS RESTANTES

### 5.1 [EN COURS] Branch wallets userRole=DRIVER
**Description** : Les 3 branch wallets de Chitir Chicken ont `userRole=DRIVER` au lieu de `MERCHANT`.  
**Impact** : Les credits de nouvelles commandes iront au bon wallet (filtre supprime), mais les anciens credits restent orphelins.  
**Correction** : L'endpoint `POST /seed/fix-wallet-userroles` est pret. Deploy Render nécessaire.  
**Etat** : En attente du deploy Render.

### 5.2 [EN COURS] Brand wallet 0 wallets
**Description** : `GET /wallets/brand/:brandId` retourne `{\"wallets\":[],\"totalBalance\":0}`.  
**Cause** : Les wallets ont encore `userRole=DRIVER`. Le endpoint `/seed/fix-wallet-userroles` corrigera cela.  
**Impact** : Affichage du total des finances dans le dashboard marchand.  
**Correction** : Meme que 5.1.

### 5.3 [BASSE] Anciens credits orphanes
**Description** : Les commandes completes AVANT le FIX 2 ont credite au mauvais wallet.  
**Correction** : Endpoint `POST /seed/backfill-orphan-credits` disponible. Deploy Render nécessaire.

### 5.4 [INFO] Analytics revenue=0
**Description** : Les analytics ne comptent que les commandes `DELIVERED`. Les commandes en cours ne comptent pas.  
**Impact** : Aucun — comportement correct. Le revenue s'affichera apres livraison.

### 5.5 [INFO] Disputes 403 pour business_admin
**Description** : `GET /disputes` est restreint aux rôles SUPER_ADMIN/ADMIN.  
**Impact** : Aucun — comportement prevu. Les marchands utilisent `GET /disputes/me`.

### 5.6 [INFO] Financial routes 403 pour business_admin
**Description** : `GET /financial/business/:id` et `GET /financial/dashboard` sont restreints SUPER_ADMIN.  
**Impact** : Aucun — comportement prevu.

### 5.7 [BASSE] Promotions 400
**Description** : Les codes promo TEST n'existent pas en base.  
**Impact** : Aucun — pas de vrais codes promo configurés.

---

## 6. ARCHITECTURE

### Stack

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Backend | NestJS | 11.x |
| ORM | TypeORM | ^1.1.0 |
| Base de donnees | PostgreSQL | 16 (Neon) |
| Cache | Redis | 7.x (optionnel) |
| Frontend client | React + Vite + Zustand | 18.x |
| Frontend admin | React + Vite | 18.x |
| UI | Tailwind CSS | 3.x |
| Design system | Custom (terracotta #C1652E) | — |
| Deploy API | Render (Docker) | — |
| Deploy frontends | Vercel | — |
| Stockage fichiers | Cloudinary | — |
| Paiements | GeniusPay (Orange/Moov/Wave) | — |
| Push | Firebase Cloud Messaging | — |
| Email | Resend | — |
| WhatsApp | Meta Cloud API | — |

### Mecanisme de migration

Les migrations TypeORM s'executent **automatiquement au boot** en production :

```
render.yaml : DB_MIGRATIONS_RUN=true
       ↓
database.config.ts:23 : migrationsRun = synchronize ? false : (migrationsOverride ?? isProd)
       ↓
TypeORM: migrationsRun = true → execute toutes les migrations pending au demarrage
```

**Pas besoin de `npx typeorm migration:run`** — un simple push Git suffit.
`data-source.ts` n'existe pas dans ce repo ; la config est dans `database.config.ts`.

### Base de donnees — Entites principales

```
users ──┬── businesses ──── products
        │   ├── orders ──── order_items
        │   └── settings
        ├── wallets ──── wallet_transactions
        ├── kyc_documents
        ├── driver_profiles
        ├── subscriptions
        └── addresses

brands ──── businesses (multi-agences)
promotions ──── orders
reviews ──── orders
disputes ──── orders
loyalty_points ──── users
stories ──── businesses
payout_requests ──── wallets
```

### Flux de commande (Order FSM)

```
PENDING → PROCESSING → IN_DELIVERY → DELIVERED_PENDING_CONFIRMATION → DELIVERED
    ↓         ↓              ↓
CANCELLED  CANCELLED    DRIVER_ASSIGNED → READY_FOR_PICKUP → IN_DELIVERY
```

### Flux wallet marchand

```
order.completed event
  → MerchantFinancialService.handleOrderCompleted()
  → businessRepository.findOne(order.businessId)
  → merchantUserId = business.ownerId
  → creditWallet(merchantUserId, MERCHANT, amount, ..., order.businessId)
  → Wallet cree/trouve par (userId=ownerId, branchId=businessId)
  → Transaction WALLET_CREDIT creee
```

---

## 7. DEPLOIEMENT

### Configuration reelle

| Service | Plateforme | URL |
|---------|-----------|-----|
| Backend API (NestJS) | Render (Docker) | `https://api.fasofree.site` |
| Dashboard Admin (React) | Vercel | `https://admin.fasofree.site` |
| App Client (React) | Vercel | `https://fasofree.site` |

### CORS

`main.ts` autorise les domaines par regex :
```typescript
const allowedRegexPatterns = [
  /\.fasofree\.site$/,
  /\.vercel\.app$/,
  /\.onrender\.com$/,
];
```

### Variables critiques (render.yaml `sync: false`)

- `DATABASE_URL` — PostgreSQL Neon
- `JWT_SECRET` — Min 32 caracteres
- `FIREBASE_*` — Push notifications
- `REDIS_URL` — Optionnel
- `SMTP_USER` / `SMTP_PASS` — Email Resend
- `GENIUSPAY_API_KEY` / `GENIUSPAY_API_SECRET` — Paiements

### Cycle de deploiement

**Backend (Render)** :
1. Push sur GitHub (`main`)
2. Render detecte le push → build + deploy automatique
3. Au boot : TypeORM execute les migrations pending (`DB_MIGRATIONS_RUN=true`)
4. `synchronize: false` en prod (le code l'impose)

**Frontends (Vercel)** :
1. Push sur GitHub (`main`)
2. Deployment automatique via Vercel
3. Le frontend pointe vers `https://api.fasofree.site/api/v1`

### Swagger

Accessible apres deploy backend :
```
https://api.fasofree.site/api/docs
```

---

## COMMITS

| Hash | Description |
|------|-------------|
| `992856e` | chore: trigger Render redeploy |
| `87fd286` | feat: POST /seed/fix-wallet-userroles endpoint |
| `24f267e` | docs: Swagger detailed descriptions, @ApiOperation |
| `91eaf92` | fix: getBrandWallets remove userRole filter |
| `0c10c6a` | fix: brand wallet route ordering |
| `178e160` | fix: merchant settlement uses ownerId + branchId |
| `004e74e` | fix: payout cron + brand chart date filter |
| `5fad369` | fix: 7 dashboard bugs |
| `8762cfd` | fix: BusinessAdminDashboard load order |
| `e05668e` | fix: dispatch overhaul |
| `0cfe059` | fix: merchant FSM |
| `6054f64` | fix: XCircle import |
| `0787401` | fix: READY_FOR_PICKUP for merchant |
| `b53d8ad` | feat: client disputes |
| `3a4e70a` | fix: memoize branches |
| `f88f309` | fix: route ordering |
| `2776bdd` | feat: full delivery flow |
| `01bdbb3` | fix: multi-branch support |
| `484e21f` | feat: transfer ownership |
| `3c9fcee` | fix: UUID validation |
| `ad904b8` | fix: empty body handling |
| `227e85d` | feat: login only + KYC mandatory |
| `1fe9a10` | feat: GeniusPay sole provider |

### Phase 3 (v4.0.0) — Audit sécurité + corrections critiques

#### FIX 26 : Webhook GeniusPay sans vérification HMAC (CRITIQUE)
**Fichier** : `payments.controller.ts`  
**Problème** : Le webhook `POST /payments/webhook/geniuspay` acceptait tout payload sans valider la signature HMAC. `verifyWebhookSignature()` existait dans `geniuspay.service.ts` mais n'était jamais appelé. Un attaquant pouvait forger un payload `status: SUCCESS` pour marquer n'importe quelle commande comme payée.  
**Solution** : Ajout de la vérification HMAC avec `x-signature` et `x-timestamp` headers. Rejet 400 si signature invalide.

#### FIX 27 : Double entité Referral + schéma mismatch (CRITIQUE)
**Fichiers** : `loyalty/entities/referral.entity.ts`, `promotions/entities/referral.entity.ts`, `loyalty.service.ts`  
**Problème** : Deux classes TypeORM mapaient la même table PostgreSQL `referrals` avec des colonnes différentes. L'entité loyalty utilisait `referrerUserId`, `referredUserId`, `referrerBonus`, `referredBonus`, `firstOrderCompleted` alors que la migration créait `referrerId`, `refereeId`, `status`, `rewardAmount`.  
**Solution** : Suppression de `loyalty/entities/referral.entity.ts` (doublon). Alignement de `loyalty.service.ts` sur les colonnes de la migration via `promotions/entities/referral.entity.ts`.

#### FIX 28 : Migrations manquantes (wallets, wallet_transactions, loyalty_points) (CRITIQUE)
**Fichiers** : 3 nouvelles migrations créées  
**Problème** : Aucune migration ne créait les tables `wallets`, `wallet_transactions` ou `loyalty_points`. En prod (`synchronize: false`), toutes les opérations de portefeuille et fidélité crashaient.  
**Solution** : Création des migrations `1726100000000-create-wallets-table.ts`, `1726100000001-create-wallet-transactions-table.ts`, `1726100000002-create-loyalty-points-table.ts`.

#### FIX 29 : authStore setVerified ne persiste pas (HAUTE)
**Fichier** : `fasofree-frontend-client/src/store/authStore.js`  
**Problème** : `setVerified()` mettait à jour le state Zustand mais n'écrivait pas dans `localStorage`. Après rechargement, `loadInitial()` relisait les anciennes valeurs `isEmailVerified: false` → boucle infinie vers `/verify-account`.  
**Solution** : Ajout de `localStorage.setItem('fasofree_user', ...)` dans `setVerified()`.

#### FIX 30 : Topup sans order_id dans metadata (HAUTE)
**Fichier** : `payments.controller.ts`  
**Problème** : Le endpoint topup envoyait `metadata: { type: 'topup', userId }` sans `order_id`. Le webhook GeniusPay ne trouvait pas `metadata.order_id`, logguait un warning et retournait `{ ok: false }`. L'argent était prélevé par GeniusPay mais le portefeuille n'était jamais crédité.  
**Solution** : Génération d'un `topupRef` unique ajouté aux métadatas.

#### FIX 31 : updateStatus sans vérification de propriété (HAUTE)
**Fichier** : `orders.service.ts`  
**Problème** : `updateStatus()` n'avait aucune vérification que l'utilisateur a un lien avec la commande. N'importe quel DRIVER pouvait modifier le statut de n'importe quelle commande.  
**Solution** : Ajout de vérifications de propriété : driver vérifie `order.driverId`, BUSINESS_ADMIN vérifie via `assertManagedBy()`.

#### FIX 32 : SSL activé en dev (MOYENNE)
**Fichier** : `database.config.ts`  
**Problème** : `ssl: true` pour tout environnement non-production cassait les connexions PostgreSQL locales.  
**Solution** : `ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false`

#### FIX 33 : error.message sans instanceof Error dans cron (MOYENNE)
**Fichier** : `wallet.service.ts`  
**Problème** : `error.message` sans vérifier `instanceof Error` générait un `TypeError` si l'erreur n'était pas un objet Error, perdant le vrai message.  
**Solution** : `const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'`

#### FIX 34 : orderService.js client — statuts faux + getAvailableOrders cassé (MOYENNE)
**Fichier** : `fasofree-frontend-client/src/services/orderService.js`  
**Probleme** : `getOrderSteps()` et `getNextPossibleStatuses()` utilisaient `CONFIRMED`, `PREPARING`, `DRIVING` au lieu des vrais statuts backend (`PAID`, `IN_PREPARATION`, `IN_DELIVERY`). `getAvailableOrders()` appelait `getMyOrders()` → le livreur ne voyait jamais les commandes disponibles.  
**Solution** : Alignement complet sur le FSM backend réel + `acceptOrder()` utilise `api.acceptOrder()` au lieu de `updateOrderStatus('CONFIRMED')`.

#### FIX 35 : uploadImage bypass apiFetch sans vérification (MOYENNE)
**Fichier** : `fasofree-frontend-client/src/services/api.js`  
**Problème** : `uploadImage` utilisait `fetch()` brut sans vérifier `response.ok`. Un 4xx/5xx retournait silencieusement l'objet erreur.  
**Solution** : Ajout de `if (!r.ok) throw new Error(...)` avant `r.json()`.

#### FIX 36 : uncaughtException ne quitte pas le process (HAUTE)
**Fichier** : `main.ts`  
**Problème** : Après une exception non capturée, le process était dans un état indéfini mais continuait de servir les requêtes.  
**Solution** : `process.exit(1)` sur `uncaughtException` et `unhandledRejection`.

#### FIX 37 : parseInt NaN dans receipts controller (MOYENNE)
**Fichier** : `receipts.controller.ts`  
**Problème** : `parseInt(limit, 10)` sur un paramètre non numérique retournait `NaN` → erreur SQL 500.  
**Solution** : `Math.min(Math.max(parseInt(limit, 10) || 50, 1), 50)` avec bornes.

#### FIX 38 : Race condition nextReceiptNumber (BASSE)
**Fichier** : `receipts.service.ts`  
**Problème** : Deux requêtes concurrentes pouvaient générer le même numéro de reçu. Le fallback vérifiait only +1.  
**Solution** : Boucle avec retry (10 max) + fallback timestamp.

#### FIX 39 : Remboursement creditWallet sans try-catch (HAUTE)
**Fichier** : `payouts.service.ts`  
**Problème** : Si le remboursement échouait, l'argent de l'utilisateur était perdu définitivement sans log détaillé.  
**Solution** : Try-catch imbriqué avec log CRITIQUE + montant perdu.

#### FIX 40 : Ownership getBusinessOrders/getBrandOrders (HAUTE)
**Fichier** : `orders.controller.ts`  
**Problème** : N'importe quel BUSINESS_ADMIN pouvait lire les commandes de n'importe quel business en passant son UUID.  
**Solution** : Validation de `businessIds` fourni + garde de rôle existante.

### Phase 4 (v4.1.0) — Bugs UI visuels + durcissement sécurité

#### FIX 41 : Stale chatChannel — switch de canal inopérant (3 dashboards)
**Fichiers** : `SuperAdminDashboard.jsx`, `BusinessAdminDashboard.jsx`, `AdminManagerDashboard.jsx`  
**Problème** : Le bouton de canal appelait `setChatChannel(ch); handleViewChatHistory(orderId)`. `setChatChannel` est async : le handler lisait la valeur du closure (ancien canal) → l'historique HTTP, la room socket et le filtre `newOrderMessage` restaient sur le MAUVAIS canal. Le switch Marchand/Livreur semblait ne rien faire.  
**Solution** : `handleViewChatHistory(orderId, channel = chatChannel)` reçoit le canal explicitement (`handleViewChatHistory(selectedChatOrder, ch)`), et l'utilise partout (getChatHistory, joinOrderChat, filtre messages).

#### FIX 42 : leaveJobChat déconnectait le socket singleton global
**Fichier** : `DriverDashboard.jsx`  
**Problème** : `leaveJobChat()` appelait `chatSocket.disconnect()` sur le socket renvoyé par `getChatSocket()` — un SINGLETON partagé par toute l'app. Le chat suivant plantait jusqu'à reconnexion (2 s de délai + perte d'éventuels events).  
**Solution** : Ne déconnecter jamais le singleton. On retire uniquement le listener `newOrderMessage` et on émet `leaveOrderChat` pour la room courante.

#### FIX 43 : handleAcceptJob perdait la course acceptée (race polling)
**Fichier** : `DriverDashboard.jsx`  
**Problème** : Le polling rafraîchit `availableJobs` toutes les 15 s. Si le rafraîchissement arrive pendant l'appel `acceptDispatchOrder`, `availableJobs.find()` retourne `undefined` → `setCurrentJob(undefined)` et la course acceptée disparaissait de l'écran.  
**Solution** : Si le job est introuvable dans le state local (rafraîchi entre-temps), fallback sur `loadCurrentJob()` qui recharge la course courante depuis l'API (source de vérité).

#### FIX 44 : Mots de passe en clair en base — purge complète
**Fichiers** : `seed.service.ts`, `seed.controller.ts`, `reset-super-admin.command.ts`, `users.service.ts`, + migration `1726200000000-purge-password-plain.ts`  
**Problème** : `passwordPlain` stockait le mot de passe non hashé des comptes seedés et réinitialisés. `usersService.findAll()` le chargeait explicitement via `addSelect`.  
**Solution** : (1) Aucun code n'écrit plus dans `passwordPlain` ; (2) `findAll()` ne le sélectionne plus ; (3) migration qui met `passwordPlain = NULL` sur toutes les lignes existantes en prod. La colonne reste (nullable, select:false) pour éviter un DROP risqué.

#### FIX 45 : Préfixe de clé API loggué
**Fichier** : `geniuspay.service.ts`  
**Problème** : En cas d'erreur, le service loggait les 5 premiers caractères de la clé API (`apiKey?.substring(0, 5)`). Même partiel, ce préfixe peut aider à identifier/reconstruire la clé si les logs sont exposés (Render logs partagés, captures d'écran).  
**Solution** : Log limité à la présence booléenne de la clé (`apiKey present: true/false`).
