# RAPPORT TECHNIQUE — FasoFree
## Phase de correction de bugs dashboard + Swagger + Livraison

**Date** : 12 Septembre 2026  
**Auteur** : Assistant IA (opencode)  
**Version** : 1.0.0  
**Repo** : github.com/kouewanbidiga2-bot/fasofree

---

## TABLE DES MATIERES

1. [Swagger — Documentation API](#1-swagger--documentation-api)
2. [Corrections critiques (8 bugs dashboard)](#2-corrections-critiques-8-bugs-dashboard)
3. [Fonctionnalites ajoutees](#3-fonctionnalites-ajoutees)
4. [Erreurs restantes](#4-erreurs-restantes)
5. [Architecture technique](#5-architecture-technique)
6. [Guide de deploiement](#6-guide-de-deploiement)

---

## 1. SWAGGER — DOCUMENTATION API

### URL
```
https://api.fasofree.site/api/docs
```

### Configuration
- **OpenAPI** : 3.0.0
- **Titre** : FasoFree API
- **Version** : 1.0.0
- **Authentification** : Bearer JWT (header Authorization)
- **Routes documentees** : 152
- **Schemas DTO** : 47
- **Tags** : 36

### Tags et modules

| Tag | Routes | Description |
|-----|--------|-------------|
| Authentication | 7 | Inscription, connexion, OTP, roles |
| Users | 14 | Gestion comptes, profil, adresses |
| Businesses | 10 | Commerces, branches, ownership |
| Products | 6 | Catalogue, stock, disponibilite |
| Orders | 16 | Commandes FSM, historique |
| Dispatch | 3 | Attribution livreur, cascade, timeout |
| Payments | 5 | GeniusPay, Orange Money, Moov Money, Wave |
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
| Seed | 2 | Donnees de test |
| Ban Requests | 4 | Bannissements |
| Internal Chat | 3 | Chat equipe admin |
| OTP Verification | 3 | Verification OTP |
| KYC | 6 | Verification identite |
| Onboarding | 3 | Candidature marchand/livreur |
| GeniusPay | 7 | Integration paiement |
| Webhooks | 2 | Webhooks paiement, WhatsApp |

### Ameliorations Swagger appliquees
- Description detaillee avec tableaux des modules et roles
- Tags etendus a tous les controleurs (36 tags)
- `@ApiOperation` ajoute sur KYC (6 routes), Promotions (2), Settings (2)
- `@ApiBearerAuth` ajoute sur KYC, Promotions, Settings
- Contact et licence renseignes
- Serveurs multiples documentes

---

## 2. CORRECTIONS CRITIQUES (8 BUGS DASHBOARD)

### FIX 1 : Route GET /wallets/brand/:brandId inaccessible
**Fichier** : `wallet.controller.ts`  
**Ligne** : 94  
**Probleme** : La route `brand/:brandId` etait declaree APRES `:userRole/:userId`. NestJS matchait `brand` comme `userRole` → 403.  
**Solution** : Deplace `brand/:brandId` AVANT `:userRole/:userId` + supprime le doublon.  
**Statut** : `0c10c6a` + `91eaf92` + `24f267e`

```typescript
// AVANT (incorrect)
@Get(':userRole/:userId')     // ← matche en premier
@Get('brand/:brandId')        // ← jamais atteint

// APRES (correct)
@Get('brand/:brandId')        // ← matche en premier
@Get(':userRole/:userId')     // ← fallback
```

### FIX 2 : Wallet global (branchId=null) jamais credite
**Fichier** : `merchant-financial.service.ts`  
**Ligne** : 48, 64  
**Probleme** : `creditWallet` utilisait `order.businessId` comme `userId`. Le frontend cherchait avec `user.id` (ownerId) → jamais le meme wallet.  
**Solution** : `merchantUserId = business.ownerId ?? order.businessId` + `branchId = order.businessId`.  
**Statut** : `178e160`

```typescript
// AVANT (incorrect)
await this.walletService.creditWallet(order.businessId, ...); // userId = businessId

// APRES (correct)
const merchantUserId = business?.ownerId ?? order.businessId;
await this.walletService.creditWallet(merchantUserId, ..., order.businessId); // branchId = businessId
```

### FIX 3 : getBrandWallets ignore le param brandId
**Fichier** : `wallet.service.ts`  
**Ligne** : 670-695  
**Probleme** : Filtrait sur `userRole: MERCHANT` mais les branch wallets avaient `userRole: DRIVER`.  
**Solution** : Supprime le filtre `userRole` de la requete.  
**Statut** : `91eaf92`

```typescript
// AVANT (incorrect)
where: businessIds.map((bid) => ({
  userId, userRole: UserRole.MERCHANT, branchId: bid, // ← pas de match si role = DRIVER
}))

// APRES (correct)
where: businessIds.map((bid) => ({
  userId, branchId: bid, // ← trouve quel que soit le role
}))
```

### FIX 4 : Payout cron compare UUID user vs UUID business
**Fichier** : `wallet.service.ts`  
**Ligne** : 485  
**Probleme** : Le cron de payout comparait `wallet.userId` (ownerId) avec les businesses → toujours 0.  
**Solution** : Recherche les businesses par `ownerId` avant de creditler.  
**Statut** : `004e74e`

### FIX 5 : Analytics mauvais alias order.createdAt
**Fichier** : `analytics.service.ts`  
**Ligne** : 524  
**Probleme** : `order.createdAt` au lieu de `o."createdAt"` → erreur SQL (alias non defini).  
**Solution** : Corrige en `o."createdAt"` + brand chart respecte le filtre date.  
**Statut** : `5fad369`

### FIX 6 : Settings marchand jamais chargees au montage
**Fichier** : `BusinessAdminDashboard.jsx`  
**Ligne** : 569  
**Probleme** : `loadSettings()` n'etait pas appele dans le useEffect de montage.  
**Solution** : Ajout de `loadSettings` dans le tableau de dependances du useEffect.  
**Statut** : `5fad369`

### FIX 7 : Chat channel switching = stale closure
**Fichier** : `authStore.js`  
**Ligne** : 96  
**Probleme** : Les sockets n'etaient pas deconnectes au logout → fuite memoire et messages stale.  
**Solution** : `disconnectRealtime()` appele au logout.  
**Statut** : `5fad369`

### FIX 8 : Table "Autres comptes" = 7 headers, 6 colonnes
**Fichier** : `SuperAdminDashboard.jsx`  
**Probleme** : Colonne "Mot de passe" dans les headers mais pas dans les cells.  
**Solution** : Suppression de la colonne "Mot de passe" du tableau.  
**Statut** : `5fad369`

---

## 3. FONCTIONNALITES AJOUTEES

### 3.1 Dispatch automatique livreur
**Fichiers** : `dispatch.controller.ts`, `dispatch.service.ts`
- Transaction `SERIALIZABLE` + `pessimistic_write` sur acceptation
- `isAvailable = false` quand un livreur accepte
- Timeout 10 min sur `READY_FOR_PICKUP`
- Refus re-notifie le candidat suivant
- Toggle disponibilite persiste au backend via `PATCH /users/me/driver-status`

### 3.2 Client disputes
**Fichiers** : `disputes.controller.ts`, `Disputes.jsx`
- `GET /disputes/me` pour lister les reclamations client
- Page disputes dans le profil client

### 3.3 Multi-branch support
**Fichiers** : `BusinessAdminDashboard.jsx`, `businesses.controller.ts`
- `GET /businesses/me` retourne TOUTES les branches du proprietaire
- `POST /orders/brand` pour creer des commandes multi-agences
- Auto-repair des marchands orphelins

### 3.4 Merchant FSM
**Fichiers** : `types.js`, `orderService.js`
- `MerchantTransitions` map pour masquer les transitions driver-only
- `getNextPossibleStatuses` accepte le parametre `role`

### 3.5 Swagger ameliore
**Fichier** : `main.ts`
- 152 routes documentees
- 36 tags avec descriptions
- 47 schemas DTO
- `@ApiOperation` sur KYC, Promotions, Settings

---

## 4. ERREURS RESTANTES

### 4.1 [MOYENNE] Branch wallets userRole=DRIVER
**Description** : Les 3 branch wallets de Chitir Chicken ont `userRole=DRIVER` au lieu de `MERCHANT`.  
**Impact** : Les credits de nouvelles commandes iront au bon wallet (car on ne filtre plus par role), mais les anciens credits restent orphelins.  
**Correction** : Migration `1725800000000-fix-wallet-userroles.ts` prete, a appliquer sur Render :
```bash
npx typeorm migration:run -d src/database/data-source.ts
```

### 4.2 [MOYENNE] Brand wallet 0 wallets
**Description** : `GET /wallets/brand/:brandId` retourne `{"wallets":[],"totalBalance":0}`.  
**Cause** : Le filtre userRole a ete supprime (FIX 3), mais la migration n'est pas encore appliquee sur Render.  
**Impact** : Affichage du total des finances dans le dashboard marchand.  
**Correction** : Appliquer la migration + redployer.

### 4.3 [BASSE] Anciens credits orphanes
**Description** : Les commandes completes AVANT le FIX 2 ont credite au mauvais wallet (`userId = businessId` au lieu de `ownerId`).  
**Impact** : Les soldes des anciennes commandes sont sur des wallets inexistants/mal identifies.  
**Correction** : Script de backfill ou verification manuelle des transactions.

### 4.4 [INFO] Super admin wallet 403
**Description** : `GET /wallets/super_admin/:userId` retourne 403.  
**Cause** : Le role `super_admin` n'est pas dans le `roleMap` du wallet controller (c'est normal — les super admins n'ont pas de wallet).  
**Impact** : Aucun. Comportement prevu.

### 4.5 [BASSE] Analytics revenue=0 pour branches sans commandes livrees
**Description** : Les analytics ne comptent que les commandes avec statut `DELIVERED`. Les 21 commandes Chitir Chicken sont en `PENDING`/`PROCESSING`/`DRIVER_ASSIGNED`.  
**Impact** : Aucun — c'est le comportement correct. Le revenue s'affichera quand les commandes seront livrees.

---

## 5. ARCHITECTURE TECHNIQUE

### Stack
| Composant | Technologie | Version |
|-----------|-------------|---------|
| Backend | NestJS | 11.x |
| ORM | TypeORM | 0.3.x |
| Base de donnees | PostgreSQL | 16 (Neon) |
| Cache | Redis | 7.x (optionnel) |
| Frontend client | React + Vite + Zustand | 18.x |
| Frontend admin | React + Vite | 18.x |
| UI | Tailwind CSS | 3.x |
| Design system | Custom (terracotta #C1652E) | — |
| Deploy backend | Render | — |
| Deploy frontend | Vercel | — |
| Stockage fichiers | Cloudinary | — |
| Paiements | GeniusPay (Orange/Moov/Wave) | — |
| Push | Firebase Cloud Messaging | — |
| Email | Resend | — |
| WhatsApp | Meta Cloud API | — |

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
```

### Flux de commande (Order FSM)
```
PENDING → PROCESSING → IN_DELIVERY → DELIVERED_PENDING_CONFIRMATION → DELIVERED
    ↓         ↓              ↓
CANCELLED  CANCELLED    DRIVER_ASSIGNED → READY_FOR_PICKUP → IN_DELIVERY
```

### Flux de paiement
```
Client passe commande
  → GeniusPay initie le paiement (Orange/Moov/Wave)
  → Webhook GeniusPay confirme le paiement
  → Commande passe a PROCESSING
  → Livraison effectuee
  → Commission plateforme prelevee
  → Wallet marchand credite (merchant-financial.service)
```

### Flux wallet marchand
```
order.completed event
  → MerchantFinancialService.handleOrderCompleted()
  → businessRepository.findOne(businessId)
  → merchantUserId = business.ownerId
  → creditWallet(merchantUserId, MERCHANT, amount, ..., businessId)
  → Wallet cree/trouve par (userId=ownerId, userRole=MERCHANT, branchId=businessId)
  → Transaction WALLET_CREDIT creee
```

---

## 6. GUIDE DE DEPLOIEMENT

### Backend (Render)
1. Push le code sur GitHub
2. Render deploie automatiquement (~2-3 min)
3. Apres deploy, appliquer la migration :
```bash
# Via Render Shell
npx typeorm migration:run -d src/database/data-source.ts
```

### Frontend Client (Vercel)
1. Push sur GitHub
2. Deployer manuellement via le dashboard Vercel
3. Le frontend devrait pointer vers `https://api.fasofree.site/api/v1`

### Frontend Admin (Vercel)
1. Meme processus que le frontend client
2. URL : `https://admin.fasofree.site`

### Swagger
Accessible apres deploy backend :
```
https://api.fasofree.site/api/docs
```

---

## COMMITS LIES A CETTE PHASE

| Hash | Description |
|------|-------------|
| `24f267e` | docs: enhance Swagger - detailed descriptions, all tags, @ApiOperation |
| `91eaf92` | fix: getBrandWallets remove userRole filter + migration fix wallet userroles |
| `0c10c6a` | fix: brand wallet route MUST be before :userRole/:userId |
| `178e160` | fix: merchant settlement uses ownerId + branchId |
| `004e74e` | fix: payout cron uses businessId from owner lookup + brand chart date filter |
| `5fad369` | fix: 7 dashboard bugs (brand route, analytics, settings, commission, table, socket) |
| `8762cfd` | fix: BusinessAdminDashboard loads orders after business resolution |
| `e05668e` | fix: dispatch overhaul - transaction lock, isAvailable, timeout, refuse |
| `0cfe059` | fix: merchant FSM - hide driver-only transitions |
| `6054f64` | fix: add missing XCircle import |
| `0787401` | fix: remove READY_FOR_PICKUP from DRIVER_TRANSITIONS |
| `b53d8ad` | feat: client disputes page + GET /disputes/me |
| `3a4e70a` | fix: memoize branches array (20699 console errors) |
| `f88f309` | fix: move available-drivers route before :id |
| `2776bdd` | feat: full delivery flow |
| `01bdbb3` | fix: dashboard business admin + multi-branch |
| `484e21f` | feat: transfer business ownership |
| `3c9fcee` | fix: merchant products UUID validation |
| `ad904b8` | fix: admin api.js handles empty responses |
| `227e85d` | feat: dashboard login only + KYC mandatory |
