# FasoFre — audit de la base existante pour la refonte livraison

## Décision produit

FasoFre n’est plus une marketplace de repas. L’application organise des livraisons.
Un repas peut être livré lorsqu’il a déjà été commandé auprès d’un restaurant,
d’un commerçant ou par WhatsApp, mais FasoFre ne vend pas le repas dans le MVP.

## 1. Technologie

- Client : React 18, Vite, React Router, Tailwind CSS, Zustand, React Query.
- Back-office : React 18, Vite, Tailwind CSS, dashboards multi-rôles.
- API : NestJS 11, TypeScript, TypeORM.
- Données : PostgreSQL.
- Temps réel : Socket.IO.
- Disponibilité et position : Redis et géolocalisation.
- PWA : manifest, service worker et installation mobile.
- Notifications : Firebase, SMS, e-mail et WhatsApp déjà prévus dans l’API.
- Paiements : SasPay et flux Mobile Money déjà présents dans le backend.

## 2. Structure utile

```text
fasofree-frontend-client/   Application client / expéditeur
fasofree-frontend/          Back-office et interfaces opérationnelles
fasofree-backend/            API, données, dispatch et règles métier
fasofree-agent/              Service agent séparé à examiner avant décision
docs/                        Documentation technique et produit
```

## 3. Interfaces déjà disponibles

### Client

- authentification par téléphone ;
- création de livraison P2P ;
- suivi de commande ;
- historique ;
- adresses ;
- litiges ;
- notifications ;
- support ;
- PWA.

### Livreur et opérations

- dashboard livreur ;
- disponibilité ;
- missions ;
- historique et revenus ;
- carte et suivi ;
- gestion des agences de livraison ;
- affectation et dispatch.

### Back-office

- super administrateur ;
- administrateur ;
- support ;
- marchand/partenaire ;
- agence de livraison ;
- suivi des commandes en direct ;
- candidatures et KYC ;
- litiges et messagerie interne ;
- campagnes de notifications ;
- finances et wallets.

## 4. Fonctionnement existant à réutiliser

- `P2P_DELIVERY` constitue la base du service livraison ;
- les positions des livreurs sont stockées et diffusées en temps réel ;
- le dispatch possède déjà des providers internes, manuels et agences ;
- la tarification P2P est calculée côté serveur à partir de la distance ;
- les codes et preuves de livraison sont déjà prévus ;
- le KYC livreur et agence existe ;
- les litiges, pénalités, audit et fraude existent ;
- les notifications multicanales existent ;
- les promotions, fidélité et campagnes peuvent être conservées pour la phase 7.

## 5. Rôles à stabiliser

- client / expéditeur ;
- livreur indépendant ;
- agence ou société de livraison partenaire ;
- commerçant / entreprise cliente ;
- opérateur dispatch ;
- support ;
- marketing ;
- finance ;
- product manager ;
- administrateur ;
- super administrateur.

## 6. Statuts de livraison à normaliser

```text
CREATED
→ AWAITING_PAYMENT ou PAID
→ SEARCHING_DRIVER
→ DRIVER_ASSIGNED
→ PICKED_UP
→ IN_DELIVERY
→ DELIVERED_PENDING_CONFIRMATION
→ DELIVERED
```

États transversaux : `CANCELLED`, `FAILED`, `DISPUTED`, `REFUNDED`.

Le nom visible par le client doit être différent du nom technique lorsque cela
améliore la compréhension, mais chaque état doit avoir une seule définition métier.

## 7. Risques techniques à traiter avant le pilote

- le client contient encore des écrans et routes de marketplace alimentaire ;
- certains dashboards sont très volumineux et mélangent état, appels API et rendu ;
- la couverture de tests frontend est insuffisante ;
- le bundle client est trop volumineux ;
- le module de notifications `sonner` est chargé à la fois statiquement et dynamiquement ;
- les migrations et modules historiques doivent être classés avant suppression ;
- la séparation entre livreur interne, agence partenaire et société externe doit être explicite ;
- le tracking public doit être validé avant de permettre un suivi sans authentification.

## 8. Périmètre après audit

À conserver et rendre prioritaire : client livraison, P2P, tracking, dispatch,
livreur, agences, support, preuves, paiements et notifications.

À sortir de l’expérience principale : catalogue restaurant, panier, checkout
alimentaire, recherche de restaurants et commande de repas.

À conserver seulement si une dépendance réelle est confirmée : composants,
services et modules backend historiques liés à l’ancien modèle.

## 9. Prochaine étape

La phase 2 doit maintenant figer :

1. les rôles et leurs permissions ;
2. les types de livraison ;
3. la machine à états ;
4. les règles tarifaires ;
5. les zones ;
6. les notifications ;
7. les preuves et règles anti-contournement.
