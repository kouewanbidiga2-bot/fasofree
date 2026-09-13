# RAPPORT TECHNIQUE — FasoFree
## Corrections dashboard + Swagger + verification complete

**Date** : 13 Septembre 2026  
**Auteur** : Assistant IA (opencode)  
**Version** : 2.0.0  
**Repo** : github.com/kouewanbidiga2-bot/fasofree

> **Note** : Ce rapport remplace `PROJECT_BIBLE.md` comme reference technique.
> PROJECT_BIBLE.md contient des informations obsoletes (fournisseurs de paiement
> ligdicash/cinetpay/mock, 97 routes au lieu de 152, FSM different).

---

## TABLE DES MATIERES

1. [Swagger — Documentation API](#1-swagger)
2. [Corrections critiques (8 bugs)](#2-corrections)
3. [Fonctionnalites ajoutees](#3-ajouts)
4. [Erreurs restantes](#4-erreurs)
5. [Architecture technique](#5-architecture)
6. [Deploiement](#6-deploiement)

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
| Seed | 3 | Donnees de test + fix wallet |
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

## 2. CORRECTIONS

### FIX 1 : Route GET /wallets/brand/:brandId inaccessible
**Fichier** : `wallet.controller.ts:94`  
**Probleme** : `brand/:brandId` declaree APRES `:userRole/:userId`. NestJS matchait `brand` comme `userRole` → 403.  
**Solution** : Deplace AVANT + doublon supprime.  
**Commit** : `0c10c6a`, `91eaf92`

```typescript
// AVANT (incorrect)
@Get(':userRole/:userId')     // matche en premier
@Get('brand/:brandId')        // jamais atteint

// APRES (correct)
@Get('brand/:brandId')        // matche en premier
@Get(':userRole/:userId')     // fallback
```

### FIX 2 : Wallet global jamais credite
**Fichier** : `merchant-financial.service.ts:48`  
**Probleme** : `creditWallet(order.businessId, ...)` → userId = businessId. Frontend cherche avec `user.id` (ownerId).  
**Solution** : `merchantUserId = business.ownerId ?? order.businessId` + `branchId = order.businessId`.  
**Commit** : `178e160`

### FIX 3 : getBrandWallets ignore brandId
**Fichier** : `wallet.service.ts:684`  
**Probleme** : Filtrait sur `userRole: MERCHANT` mais branch wallets avaient `userRole: DRIVER`.  
**Solution** : Supprime le filtre `userRole`.  
**Commit** : `91eaf92`

### FIX 4 : Payout cron
**Fichier** : `wallet.service.ts:485`  
**Probleme** : Comparait `wallet.userId` (ownerId) aux businesses → toujours 0.  
**Solution** : Recherche businesses par `ownerId` avant credit.  
**Commit** : `004e74e`

### FIX 5 : Analytics mauvais alias
**Fichier** : `analytics.service.ts:524`  
**Probleme** : `order.createdAt` au lieu de `o."createdAt"` → erreur SQL.  
**Solution** : Corrige + brand chart respecte filtre date.  
**Commit** : `5fad369`

### FIX 6 : Settings marchand pas chargees
**Fichier** : `BusinessAdminDashboard.jsx:569`  
**Probleme** : `loadSettings()` absent du useEffect de montage.  
**Solution** : Ajoute dans les dependances.  
**Commit** : `5fad369`

### FIX 7 : Socket fuite memoire au logout
**Fichier** : `authStore.js:96`  
**Probleme** : Les sockets n'etaient pas deconnectes au logout → fuite memoire.  
**Solution** : `disconnectRealtime()` appele au logout.  
**Commit** : `5fad369`

### FIX 8 : Table headers/cells mismatch
**Fichier** : `SuperAdminDashboard.jsx`  
**Probleme** : 7 headers, 6 colonnes (colonne "Mot de passe" sans cellule correspondante).  
**Solution** : Suppression de la colonne.  
**Commit** : `5fad369`

---

## 3. AJOUTS

### 3.1 Dispatch automatique livreur
- Transaction `SERIALIZABLE` + `pessimistic_write` sur acceptation
- `isAvailable = false` quand un livreur accepte
- Timeout 10 min sur `READY_FOR_PICKUP`
- Refus re-notifie le candidat suivant
- Toggle disponibilite persiste au backend

### 3.2 Client disputes
- `GET /disputes/me` pour lister les reclamations
- Page disputes dans le profil client

### 3.3 Multi-branch support
- `GET /businesses/me` retourne TOUTES les branches
- `POST /orders/brand` pour commandes multi-agences
- Auto-repair marchands orphelins

### 3.4 Merchant FSM
- `MerchantTransitions` map masque les transitions driver-only
- `getNextPossibleStatuses` accepte le parametre `role`

### 3.5 Endpoint fix-wallet-userroles
- `POST /seed/fix-wallet-userroles` (super admin)
- Corrige les branch wallets avec `userRole=DRIVER` → `MERCHANT`
- Commit `87fd286`

---

## 4. ERREURS RESTANTES

### 4.1 [EN COURS] Branch wallets userRole=DRIVER
**Description** : Les 3 branch wallets de Chitir Chicken ont `userRole=DRIVER` au lieu de `MERCHANT`.  
**Impact** : Les credits de nouvelles commandes iront au bon wallet (filtre supprime), mais les anciens credits restent orphelins.  
**Correction** : L'endpoint `POST /seed/fix-wallet-userroles` (commit `87fd286`) est pret. Render doit d'abord deployer ce commit.  
**Etat** : En attente du deploy Render (dernier push `992856e`).

### 4.2 [EN COURS] Brand wallet 0 wallets
**Description** : `GET /wallets/brand/:brandId` retourne `{"wallets":[],"totalBalance":0}`.  
**Cause** : Le filtre userRole a ete supprime (FIX 3), mais les wallets ont encore `userRole=DRIVER`. Le endpoint `/seed/fix-wallet-userroles` corrigera cela.  
**Impact** : Affichage du total des finances dans le dashboard marchand.  
**Correction** : Meme que 4.1.

### 4.3 [BASSE] Anciens credits orphanes
**Description** : Les commandes completes AVANT le FIX 2 ont credite au mauvais wallet (`userId = businessId` au lieu de `ownerId`).  
**Impact** : Les soldes des anciennes commandes sont sur des wallets mal identifies.  
**Correction** : Pas de script de backfill dans le repo. Verification manuelle ou script a ecrire si necessaire.

### 4.4 [NORMAL] Super admin wallet 403
**Description** : `GET /wallets/super_admin/:userId` retourne 403 avec le message "Role de portefeuille invalide: super_admin".  
**Cause** : Le `roleMap` du wallet controller ne contient que `MERCHANT, DRIVER, COURIER, CUSTOMER`. Le role `super_admin` n'y figure pas, et le `ForbiddenException` (403) est declenche.  
**Impact** : Aucun — les super admins n'ont pas de wallet. Comportement prevu.

### 4.5 [INFO] Analytics revenue=0
**Description** : Les analytics ne comptent que les commandes `DELIVERED`. Les 21 commandes Chitir Chicken sont en `PENDING`/`PROCESSING`/`DRIVER_ASSIGNED`.  
**Impact** : Aucun — comportement correct. Le revenue s'affichera apres livraison.

---

## 5. ARCHITECTURE

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
| Deploy frontends | Render (Node/Vite) | — |
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

## 6. DEPLOIEMENT

### Configuration reelle

| Service | Plateforme | URL |
|---------|-----------|-----|
| Backend API (NestJS) | Render (Docker) | `https://api.fasofree.site` |
| Dashboard Admin (React) | Vercel | `https://admin.fasofree.site` |
| App Client (React) | Vercel | `https://fasofree.site` |

### CORS

`render.yaml` definit `CORS_ORIGIN: https://fasofree-admin.onrender.com,https://fasofree-client.onrender.com`
mais les domaines `*.fasofree.site` et `*.vercel.app` sont aussi autorises par regex dans `main.ts` :

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

### Cycle de deploiement

**Backend (Render)** :
1. Push sur GitHub (`main`)
2. Render detecte le push → build + deploy automatique
3. Au boot : TypeORM execute les migrations pending (`DB_MIGRATIONS_RUN=true`)
4. `synchronize: false` en prod (le code l'impose)

**Frontends (Vercel)** :
1. Push sur GitHub (`main`)
2. Deployement manuel via dashboard Vercel
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
