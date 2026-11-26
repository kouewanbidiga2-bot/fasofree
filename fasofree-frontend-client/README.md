# FasoFree - Application Client

Application React/Vite/Tailwind pour les clients FasoFree qui demandent, suivent et gèrent leurs livraisons.

## 📁 Structure du projet

```
fasofree-frontend-client/
├── public/                 # Fichiers statiques
├── src/
│   ├── assets/            # Images et ressources
│   ├── components/         # Composants UI réutilisables
│   ├── pages/               # Accueil, livraison, suivi, historique, profil
│   ├── services/            # API, temps réel, notifications et PWA
│   ├── store/               # État de session et notifications
│   ├── App.jsx            # Composant principal
│   ├── main.jsx           # Point d'entrée
│   └── index.css          # Styles globaux
├── index.html             # HTML racine
├── package.json           # Dépendances
├── vite.config.js         # Configuration Vite (port 3000)
├── tailwind.config.js     # Configuration Tailwind
├── postcss.config.js      # Configuration PostCSS
└── .env                   # Variables d'environnement
```

## 🚀 Scripts disponibles

```bash
# Installation des dépendances
npm install

# Démarrage du serveur de développement
npm run dev

# Build pour production
npm run build

# Preview du build de production
npm run preview
```

## 🔧 Configuration

En développement, Vite transmet `/api/v1`, `/uploads` et `/socket.io` au backend NestJS sur `http://127.0.0.1:3100`. Le backend doit être lancé avec sa configuration PostgreSQL et SasPay pour ouvrir un paiement réel. Pour changer sa destination locale, configurer `KOLIWA_DEV_API_ORIGIN` dans `.env.local`.

Pour une version déployée sur une autre API, définir `VITE_API_BASE_URL` avant la compilation. L’envoi invité utilise `POST /api/v1/public-tracking/guest-delivery` et demande une API qui expose cette route.


## 📱 Fonctionnalités

- **Authentification** : Connexion par téléphone avec code SMS
- **Livraisons** : Création d'une livraison de colis ou récupération d'une commande déjà passée chez un commerçant
- **Tarification** : Estimation selon la distance, le poids et la fragilité
- **Paiement** : Intégration de plusieurs méthodes de paiement
- **Suivi** : Suivi en temps réel, chat, code PIN et preuve de réception
- **Profil** : Gestion du profil utilisateur

## 🔌 API Backend

Le préfixe de l’API NestJS est `/api/v1`.

### Endpoints principaux
- Authentification : `/auth/*`
- Commandes : `/orders/*`
- Dispatch : `/dispatch/*`
- Paiements : `/payments/*`

## 🎨 Technologies

- **React 18** : Framework UI
- **Vite** : Build tool et serveur de développement
- **React Router v6** : Routage
- **Tailwind CSS** : Styling
- **Fetch** : Client HTTP centralisé
- **Zustand** : Gestion d'état de session
- **Lucide React** : Icônes

## 📝 Notes

- L'application ne contient que les fonctionnalités client (Acheteur)
- Les fonctionnalités dashboard (Admin, Merchant, Driver) sont dans un projet séparé
- Le backend NestJS officiel est dans `fasofree-backend`
