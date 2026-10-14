# FasoFree — CLAUDE.md

## Projet
Application de livraison de repas et services (Burkina Faso).
- **Backend**: NestJS + TypeORM + PostgreSQL
- **Frontend client**: React + Vite (fasofree-frontend-client)
- **Frontend admin**: React (fasofree-frontend)
- **Déploiement**: Render (backend) + Vercel (frontends)

## Commandes utiles
```bash
# Backend
cd fasofree-backend
npx tsc --noEmit          # Vérifier TypeScript
npx jest                   # Tests unitaires
npm run test:e2e           # Tests E2E
npm run build              # Build production

# Frontend client
cd fasofree-frontend-client
npm run build              # Build Vite
npm run dev                # Dev server (port 5173)
```

## Architecture
- Notifications: multi-canal (FCM push + email + SMS) via `NotificationsService.sendNotification()`
- Paiements: GeniusPay (principal)
- Livraison: Système de tiers tarifaires
- Wallets: Gestion des soldes marchands/livreurs
- Litiges: Système de dispute avec remboursement

## Patterns
- Entités TypeORM avec `@PrimaryColumn('uuid')`
- DTOs avec class-validator
- Guards JWT + rôles
- WebSocket pour le tracking en temps réel
