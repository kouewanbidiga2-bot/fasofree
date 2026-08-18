# FASOFREE — PROJECT BIBLE (Documentation Complète)

> Dernière mise à jour : 2026-08-18
> Audit complet avec correction de 10+ bugs critiques, nettoyage de code mort, et alignement frontend↔backend.

---

## 1. ARCHITECTURE TECHNIQUE

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT APP                                │
│              React 18 + Vite + Zustand + PWA                     │
│         https://fasofree-frontend-client.vercel.app              │
└─────────────────────────┬────────────────────────────────────────┘
                          │ fetch (apiFetch)
┌─────────────────────────▼────────────────────────────────────────┐
│                     BACKEND API                                  │
│              NestJS + TypeORM + PostgreSQL                       │
│                https://fasofree-3nh8.onrender.com                │
│                   Global prefix: /api/v1                         │
│                                                                  │
│  ┌──────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │  Neon DB  │  │   Redis    │  │ Cloudinary │  │  Firebase   │  │
│  │ (Postgres)│  │ (Upstash)  │  │  (Storage) │  │    FCM      │  │
│  └──────────┘  └────────────┘  └────────────┘  └─────────────┘  │
└─────────────────────────┬────────────────────────────────────────┘
                          │ axios
┌─────────────────────────▼────────────────────────────────────────┐
│                    ADMIN DASHBOARD                               │
│              React 18 + Vite + Axios + Recharts                  │
│            https://fasofree-frontend.vercel.app                  │
└──────────────────────────────────────────────────────────────────┘
```

### Stack technique

| Couche | Technologie | Détails |
|--------|-------------|---------|
| Backend | NestJS 10 + TypeORM | 23 controllers, 97 routes API |
| Base de données | PostgreSQL (Neon) | Serveurless, auto-scaling |
| Cache | Redis (Upstash) | Fallback no-op si indisponible |
| Auth | JWT (passport-jwt) | Token stocké en localStorage |
| Stockage fichiers | Cloudinary > S3 > Local | Priorité automatique via STORAGE_DRIVER |
| Push notifications | Firebase Cloud Messaging | Service Worker + Token par device |
| Email | Resend API | Templates HTML approuvation/rejet |
| WhatsApp | Meta Cloud API | Messages texte + templates |
| SMS | Orange SMS (stub) | Fallback par défaut |
| Paiements | LigdiCash / CinetPay / Mock | Bascule via PAYMENT_PROVIDER |
| Frontend client | React 18 + Vite + Zustand | SPA, PWA-ready |
| Frontend admin | React 18 + Vite + Axios | Dashboard multi-rôle |

---

## 2. FONCTIONNALITÉS IMPLÉMENTÉES

### Authentification & Utilisateurs
- Inscription (email/téléphone + mot de passe)
- Connexion multi-canal (email OU téléphone)
- Mot de passe oublié → token de réinitialisation
- Changement de mot de passe (connecté)
- Rôles : CLIENT, DRIVER, COURIER, BUSINESS_ADMIN, SUPPORT, ADMIN, SUPER_ADMIN
- KYC : Upload de documents (identité, permis, carte grise) vers Cloudinary/S3
- Onboarding : candidature marchand/livreur avec approbation/rejet

### Marchands (Business)
- CRUD business (nom, catégorie, coordonnées GPS, logo, cover)
- Recherche à proximité (`/businesses/nearby`)
- Catalogue produits (CRUD + disponibilité toggle)
- Paramètres livraison/pickup
- Tableau de bord marchand

### Commandes
- Création de commande (articles + livraison)
- Devis tarifaire serveur (sous-total + frais livraison min 800 FCFA + frais plateforme 100 FCFA)
- FSM de statuts : PENDING → PAID → IN_PREPARATION → PROCESSING → DELIVERED_PENDING_CONFIRMATION → DELIVERED → COMPLETED
- Annulation, litige (dispute)
- Suivi GPS live du livreur
- Validation livraison : livreur valide → client confirme avec Code PIN 4 chiffres

### Livreurs / Coursiers
- Toggle disponibilité en ligne/hors ligne
- Liste des courses disponibles
- Acceptation de course
- Mise à jour position GPS
- Validation de livraison

### Paiements
- LigdiCash (payin + webhook)
- CinetPay
- Mode mock (simulation)
- Portefeuille (wallet) par rôle : CLIENT, DRIVER, BUSINESS_ADMIN
- Top-up portefeuille
- Taux de commission FasoFree : 0.85%

### Notifications Multi-canaux
- **Email** (Resend) : approbation/rejet candidature
- **WhatsApp** (Meta API) : messages texte
- **Push** (FCM) : notifications temps réel via Service Worker
- **SMS** (Orange, stub) : fallback
- Préférence canal par utilisateur (`preferredNotificationChannel`)

### Reviews & Notations
- Avis + note sur un target (livreur, marchand, coursier)
- Note moyenne
- Avis par commande

### Litiges (Disputes)
- Ouverture depuis une commande
- Assignation à un agent support
- Recommandation de résolution
- Approbation/rejet remboursement
- Révision client

### Abonnements (FasoFree Pass VIP)
- Plans d'abonnement (PRO, VIP)
- Souscription client et marchand
- Renouvellement automatique
- Gestion admin (CRUD plans)

### Marques (Brands)
- CRUD marques (Faso Délices, etc.)
- Recherche d'agence la plus proche
- Multi-agences par marque

### Chat
- Chat éphémère par commande (WebSocket)
- Historique des messages

---

## 3. MAPPING DES RÔLES

| Rôle | Constante | Description | Accès UI |
|------|-----------|-------------|----------|
| CLIENT | `UserRole.CLIENT` | Client final, passe des commandes | Client App |
| COURIER | `UserRole.COURIER` | Coursier (livraison à vélo/moto) | Client App (onglet Driver) |
| DRIVER | `UserRole.DRIVER` | Livreur motorisé | Client App (onglet Driver) |
| BUSINESS_ADMIN | `UserRole.BUSINESS_ADMIN` | Gérant de commerce | Admin Dashboard (BusinessAdminDashboard) |
| SUPPORT | `UserRole.SUPPORT` | Agent de support client | Admin Dashboard |
| ADMIN | `UserRole.ADMIN` | Administrateur plateforme | Admin Dashboard (AdminDashboard) |
| SUPER_ADMIN | `UserRole.SUPER_ADMIN` | Super administrateur | Admin Dashboard (SuperAdminDashboard) |

### Hiérarchie des permissions
```
SUPER_ADMIN > ADMIN > SUPPORT > BUSINESS_ADMIN > DRIVER/COURIER > CLIENT
```

---

## 4. COMPTE SUPER ADMIN PAR DÉFAUT

Créé automatiquement au démarrage du backend (`ensureMasterSuperAdmin`).

| Champ | Valeur |
|-------|--------|
| **Email** | `kouewanbidiga2@gmail.com` |
| **Téléphone** | `+22661010011` |
| **Mot de passe** | `Test@12345` |
| **Rôle** | `SUPER_ADMIN` |
| **Nom** | `Master Admin` |

### Comptes de test (Seed)

| Rôle | Email | Téléphone | Mot de passe |
|------|-------|-----------|--------------|
| CLIENT | `test.client@fasofree.bf` | `+22670000001` | `Test@12345` |
| DRIVER | `test.driver@fasofree.bf` | `+22670000002` | `Test@12345` |
| BUSINESS_ADMIN | `test.merchant@fasofree.bf` | `+22670000003` | `Test@12345` |

---

## 5. LISTE COMPLÈTE DES ENDPOINTS API

Base URL : `https://fasofree-3nh8.onrender.com/api/v1`

### Auth (`/auth`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| POST | `/auth/register` | Inscription | Public |
| POST | `/auth/apply` | Candidature marchand/livreur (multipart) | Public |
| POST | `/auth/login` | Connexion | Public |
| GET | `/auth/me` | Profil utilisateur connecté | Connecté |
| POST | `/auth/forgot-password` | Demande réinitialisation mot de passe | Public |
| POST | `/auth/reset-password` | Réinitialiser mot de passe | Public (token) |
| POST | `/auth/change-password` | Changer mot de passe | Connecté |
| POST | `/auth/debug-login` | Debug login (dev only) | Public |
| POST | `/auth/debug-register` | Debug register (dev only) | Public |

### Users (`/users`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| GET | `/users/me` | Mon profil | Connecté |
| PATCH | `/users/me` | Modifier mon profil | Connecté |
| POST | `/users/me/avatar` | Upload avatar (Cloudinary) | Connecté |
| PATCH | `/users/me/driver-status` | Toggle disponibilité livreur | DRIVER/COURIER |
| GET | `/users` | Lister tous les utilisateurs | SUPER_ADMIN |
| POST | `/users` | Créer un utilisateur | SUPER_ADMIN |
| PATCH | `/users/:id/status` | Activer/Désactiver un utilisateur | SUPER_ADMIN |
| PATCH | `/users/:id/role` | Changer le rôle d'un utilisateur | SUPER_ADMIN |
| DELETE | `/users/:id` | Supprimer un utilisateur | SUPER_ADMIN |

### Users Applications / Onboarding (`/users/applications`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| GET | `/users/applications` | Lister les candidatures | SUPER_ADMIN |
| POST | `/users/applications/:id/approve` | Approuver une candidature | SUPER_ADMIN |
| POST | `/users/applications/:id/reject` | Rejeter une candidature | SUPER_ADMIN |

### Businesses (`/businesses`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| POST | `/businesses` | Créer un business | BUSINESS_ADMIN |
| GET | `/businesses/nearby` | Recherche à proximité (GPS) | Public |
| GET | `/businesses` | Lister tous les businesses | Connecté |
| GET | `/businesses/:id` | Détail d'un business | Public |
| PATCH | `/businesses/:id` | Modifier un business | BUSINESS_ADMIN |

### Products (`/products`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| POST | `/products` | Ajouter un produit | BUSINESS_ADMIN |
| GET | `/products/business/:businessId` | Catalogue d'un business | Public |
| PATCH | `/products/:id` | Modifier un produit | BUSINESS_ADMIN |
| PATCH | `/products/:id/toggle-availability` | Toggle disponibilité | BUSINESS_ADMIN |
| DELETE | `/products/:id` | Supprimer un produit | BUSINESS_ADMIN |

### Orders (`/orders`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| GET | `/orders` | Toutes les commandes (admin) | SUPER_ADMIN/ADMIN/SUPPORT |
| POST | `/orders` | Créer une commande | Connecté |
| POST | `/orders/quote` | Devis tarifaire | Connecté |
| GET | `/orders/my-orders` | Mes commandes | Connecté |
| GET | `/orders/:id` | Détail d'une commande | Connecté |
| GET | `/orders/:id/tracking` | Suivi GPS live | Connecté |
| PATCH | `/orders/:id/status` | Changer le statut | Connecté |
| POST | `/orders/:id/accept` | Accepter une course | DRIVER/COURIER |
| POST | `/orders/:id/driver-validate` | Livreur confirme livraison | DRIVER/COURIER |
| POST | `/orders/:id/client-validate` | Client confirme avec PIN | CLIENT |
| POST | `/orders/:id/dispute` | Ouvrir un litige | CLIENT |

### Payments (`/payments`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| POST | `/payments/initiate` | Initier un paiement | Connecté |
| POST | `/payments/topup` | Recharger portefeuille | Connecté |
| POST | `/payments/mock/pay-order` | Paiement mock (dev) | Public |
| POST | `/payments/webhook/wave` | Webhook Wave | Webhook |
| POST | `/payments/webhook/ligdicash` | Webhook LigdiCash | Webhook |

### LigdiCash (`/payments/ligdicash`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| POST | `/payments/ligdicash/payin` | Payin LigdiCash | Connecté |
| POST | `/payments/ligdicash/topup` | Topup LigdiCash | Connecté |
| POST | `/payments/ligdicash/webhook` | Webhook LigdiCash | Webhook |

### Wallets (`/wallets`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| GET | `/wallets/:userRole/:userId` | Obtenir/créer un portefeuille | Connecté |
| GET | `/wallets/:walletId/transactions` | Historique des transactions | Connecté |

### KYC (`/kyc`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| POST | `/kyc/documents/:type` | Soumettre un document KYC | Connecté |
| GET | `/kyc/me` | Mes documents KYC | Connecté |
| GET | `/kyc/documents/:id/url` | URL signée d'un document | Connecté |
| GET | `/kyc/admin/pending` | Documents en attente | SUPER_ADMIN |
| POST | `/kyc/admin/:id/approve` | Approuver un document | SUPER_ADMIN |
| POST | `/kyc/admin/:id/reject` | Rejeter un document | SUPER_ADMIN |

### Financial (`/financial`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| GET | `/financial/dashboard` | Tableau de bord financier | SUPER_ADMIN |

### Reviews (`/reviews`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| POST | `/reviews` | Laisser un avis | Connecté |
| GET | `/reviews/target/:targetId` | Avis d'un target | Connecté |
| GET | `/reviews/target/:targetId/average` | Note moyenne d'un target | Connecté |
| GET | `/reviews/order/:orderId` | Avis d'une commande | Connecté |

### Disputes (`/disputes`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| POST | `/disputes/orders/:orderId` | Ouvrir un litige | Connecté |
| GET | `/disputes/me/:id` | Mon litige | Connecté |
| GET | `/disputes` | Tous les litiges (admin) | SUPER_ADMIN/ADMIN/SUPPORT |
| POST | `/disputes/:id/assign-support` | Assigner un agent | SUPER_ADMIN |
| POST | `/disputes/:id/submit-recommendation` | Recommandation résolution | SUPPORT |
| POST | `/disputes/:id/approve` | Approuver remboursement | SUPER_ADMIN |
| POST | `/disputes/:id/reject` | Rejeter un litige | SUPER_ADMIN |
| POST | `/disputes/:id/review` | Révision litige | SUPER_ADMIN |

### Subscriptions (`/subscriptions`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| GET | `/subscriptions/plans` | Lister les plans | Public |
| POST | `/subscriptions/plans` | Créer un plan | SUPER_ADMIN |
| PATCH | `/subscriptions/plans/:code` | Modifier un plan | SUPER_ADMIN |
| GET | `/subscriptions` | Lister les abonnements | SUPER_ADMIN |
| POST | `/subscriptions/assign` | Assigner un abonnement | SUPER_ADMIN |
| POST | `/subscriptions/renew` | Renouveler un abonnement | Connecté |
| GET | `/subscriptions/me` | Mon abonnement | Connecté |
| POST | `/subscriptions/subscribe` | S'abonner (client) | CLIENT |
| POST | `/subscriptions/merchant/subscribe` | S'abonner (marchand) | BUSINESS_ADMIN |

### Brands (`/brands`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| POST | `/brands` | Créer une marque | SUPER_ADMIN |
| GET | `/brands` | Lister les marques | Public |
| GET | `/brands/:id` | Détail d'une marque | Public |
| GET | `/brands/:id/nearest-business` | Agence la plus proche | Public |
| PATCH | `/brands/:id` | Modifier une marque | SUPER_ADMIN |
| DELETE | `/brands/:id` | Supprimer une marque | SUPER_ADMIN |

### Promotions (`/promotions`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| GET | `/promotions/quote` | Calculer une réduction | Connecté |
| POST | `/promotions` | Créer une promotion | SUPER_ADMIN |

### Notifications (`/notifications`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| POST | `/notifications/fcm-token` | Enregistrer token FCM | Connecté |

### Chat (`/chat`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| GET | `/chat/:orderId` | Historique du chat | Connecté |

### Uploads (`/uploads`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| POST | `/uploads/image` | Upload une image (Cloudinary) | Connecté |

### Analytics (`/analytics`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| GET | `/analytics/business/:businessId` | Vue d'ensemble business | BUSINESS_ADMIN |

### Tracking (`/tracking`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| POST | `/tracking/calculate-fee` | Calculer frais de livraison | Connecté |

### Health (`/health`)
| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| GET | `/health` | Santé du système | Public |

---

## 6. ENDPOINTS FRONTEND ≠ BACKEND (À IMPLÉMENTER)

Ces routes sont appelées par le dashboard admin mais **n'existent pas encore** sur le backend. Elles retournent `null` ou `[]` gracieusement.

| Frontend Service | Fonction | Route attendue | Statut |
|-----------------|----------|----------------|--------|
| `inventoryService.js` | `updateStock()` | POST /products/:id/stock | ⏳ À créer |
| `inventoryService.js` | `getLowStockAlerts()` | GET /products/business/:id/low-stock | ⏳ À créer |
| `inventoryService.js` | `generateSKU()` | POST /products/generate-sku | ⏳ À créer |
| `orderService.js` | `confirmDelivery()` | POST /orders/:id/confirm-delivery | ⏳ À créer |
| `orderService.js` | `updateDriverLocation()` | POST /orders/:id/driver-location | ⏳ À créer |

---

## 7. VARIABLES D'ENVIRONNEMENT REQUISES

Voir les fichiers `.env.example` dans chaque dossier :
- Backend : `fasofree-backend/.env.example`
- Client : `fasofree-frontend-client/.env.example`
- Dashboard : `fasofree-frontend/.env.example`

---

## 8. DÉPLOIEMENT

| Service | URL | Plateforme |
|---------|-----|------------|
| Backend API | https://fasofree-3nh8.onrender.com | Render (Docker) |
| Client App | https://fasofree-frontend-client.vercel.app | Vercel |
| Admin Dashboard | https://fasofree-frontend.vercel.app | Vercel |

### Variables Render critiques
```
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...
JWT_SECRET=fasofree_super_secret_key_2026_change_me_in_production
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RESEND_API_KEY=re_...
WHATSAPP_ACCESS_TOKEN=...
FIREBASE_SERVICE_ACCOUNT_JSON=...
```

---

## 9. CONVENTIONS DE CODE

### Backend (NestJS)
- Un Controller par module métier
- Validation via DTOs + class-validator
- Guard JWT + Roles sur toutes les routes protégées
- Erreurs HTTP standard : 400 (BadRequest), 401 (Unauthorized), 403 (Forbidden), 404 (NotFound), 500 (Internal)
- Logger NestJS (`this.logger.log/error`) au lieu de `console.log`

### Frontend
- Un service par domaine (authService, orderService, etc.)
- État global via Zustand stores (authStore, cartStore)
- Appels API centralisés (api.js)
- CSS utility-first (className dynamiques)
- PWA : manifest.json + service worker

### Git
- Convention : `feat(scope):`, `fix(scope):`, `refactor(scope):`
- Pas de secrets dans les commits
- `.gitignore` protège les `.env` et `node_modules`
