# 🇧🇫 FasoFree Backend API

<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="100" alt="NestJS Logo" />
</p>

> **Plateforme Backend d'API Rest & Temps Réel pour FasoFree**  
> Solution intégrée de Marketplace, Commande de repas & Livraison géolocalisée à Ouagadougou, Burkina Faso.

---

## 📌 Sommaire

- [Aperçu & Vision](#-aperçu--vision)
- [Technologies & Stack Technique](#-technologies--stack-technique)
- [Architecture du Projet](#-architecture-du-projet)
- [Installation & Démarrage](#-installation--démarrage)
- [Variables d'Environnement](#-variables-denvironnement)
- [Documentation API & Swagger](#-documentation-api--swagger)
- [Gestion des Rôles & Sécurité (RBAC)](#-gestion-des-rôles--sécurité-rbac)
- [Intégrations Métier & Paiements](#-intégrations-métier--paiements)
- [Scripts Utiles & Quality Gate](#-scripts-utiles--quality-gate)
- [Kit d'Intégration Frontend](#-kit-dintégration-frontend)

---

## 🎯 Aperçu & Vision

**FasoFree** interconnecte 4 acteurs majeurs de l'écosystème économique local :
1. **Les Clients :** Exploration des boutiques/restaurants, passage de commandes et suivi de livraison en temps réel.
2. **Les Commerçants (Merchants) :** Gestion du catalogue produit, réception et préparation des commandes.
3. **Les Livreurs (Riders) :** Assignation dynamique des courses et géolocalisation pour la livraison.
4. **L'Administration (Admins) :** Vue d'ensemble, gestion des commissions, arbitrages et métriques financières.

---

## 🛠 Technologies & Stack Technique

* **Framework Core :** [NestJS 11](https://nestjs.com/) (TypeScript 5)
* **Base de Données :** [PostgreSQL](https://www.postgresql.org/) via [TypeORM](https://typeorm.io/)
* **Cache & In-Memory Storage :** [Redis](https://redis.io/) via `ioredis` & `cache-manager`
* **Temps Réel / WebSockets :** Socket.io (`@nestjs/platform-socket.io`)
* **Documentation :** OpenAPI 3.0 / Swagger UI (`@nestjs/swagger`)
* **Monitoring & Santé :** `@nestjs/terminus`
* **Sécurité :** `helmet`, `bcrypt`, `passport-jwt`, `@nestjs/throttler` (Rate Limiting)
* **Qualité & Automation :** Husky, `lint-staged`, ESLint 9, Prettier

---

## 📂 Architecture du Projet

```text
src/
├── common/                 # Éléments partagés (Guards, Interceptors, Filters, Decorators)
│   ├── decorators/         # Ex: @Roles(), @CurrentUser()
│   ├── filters/            # GlobalExceptionFilter
│   └── guards/             # RolesGuard, JwtAuthGuard
├── config/                 # Configuration globale des modules (TypeORM, Redis, JWT)
├── database/               # Migrations et scripts de seeding
│   └── seeds/              # Jeux de données pour le développement
├── health/                 # Module de Healthcheck (Terminus)
└── modules/                # Modules applicatifs métier
    ├── auth/               # Connexion, Inscription, Tokens JWT
    ├── users/              # Profils clients, livreurs, marchands
    ├── businesses/         # Gestion des boutiques & restaurants
    ├── products/           # Catalogue de produits & catégories
    ├── orders/             # Cycle de vie des commandes & calcul des commissions
    ├── delivery/           # Assignation des coursier & géolocalisation
    └── payments/           # Webhooks & intégration CinetPay / LigdiCash / Mobile Money              
