# FasoFree - Application Client

Application React/Vite/Tailwind pour les clients FasoFree (Acheteurs).

## 📁 Structure du projet

```
fasofree-frontend-client/
├── public/                 # Fichiers statiques
├── src/
│   ├── assets/            # Images et ressources
│   ├── components/         # Composants UI réutilisables
│   │   ├── Cart.jsx       # Composant Panier
│   │   ├── Empty.jsx      # État vide
│   │   ├── Error.jsx      # Gestion d'erreurs
│   │   ├── Header.jsx     # En-tête de navigation
│   │   ├── Loading.jsx    # Indicateur de chargement
│   │   ├── MenuItem.jsx   # Carte d'article de menu
│   │   ├── OrderItem.jsx  # Carte de commande
│   │   └── RestaurantCard.jsx # Carte de restaurant/commerce
│   ├── pages/             # Pages de l'application
│   │   ├── Cart.jsx       # Page du panier
│   │   ├── Checkout.jsx   # Page de paiement
│   │   ├── Home.jsx       # Page d'accueil
│   │   ├── Orders.jsx     # Liste des commandes
│   │   ├── OrderTracking.jsx # Suivi de commande
│   │   ├── PhoneAuth.jsx  # Authentification par téléphone
│   │   ├── Profile.jsx    # Profil utilisateur
│   │   └── Restaurant.jsx # Page de restaurant
│   ├── services/          # Services API
│   │   ├── api.js         # Configuration Axios
│   │   ├── authService.js # Authentification
│   │   ├── businessService.js # Commerces/Restaurants
│   │   ├── cartService.js # Gestion du panier (Zustand)
│   │   ├── orderService.js # Commandes
│   │   └── paymentService.js # Paiements
│   ├── App.jsx            # Composant principal
│   ├── main.jsx           # Point d'entrée
│   └── index.css          # Styles globaux
├── index.html             # HTML racine
├── package.json           # Dépendances
├── vite.config.js         # Configuration Vite (port 5174)
├── tailwind.config.js     # Configuration Tailwind
├── postcss.config.js      # Configuration PostCSS
└── .env                   # Variables d'environnement
```

## 🚀 Scripts disponibles

```bash
# Installation des dépendances
npm install

# Démarrage du serveur de développement (port 5174)
npm run dev

# Build pour production
npm run build

# Preview du build de production
npm run preview
```

## 🔧 Configuration

### Variables d'environnement (.env)
```
VITE_API_URL=http://localhost:3000/api/v1
```

### Port de l'application
L'application client est configurée sur le port **5174** via `vite.config.js` :

```javascript
server: {
  port: 5174,
  strictPort: true,
}
```

## 📱 Fonctionnalités

- **Authentification** : Connexion par téléphone avec code SMS
- **Navigation** : Exploration des commerces/restaurants par catégorie
- **Panier** : Gestion du panier avec Zustand
- **Commandes** : Création de commandes avec différents modes de récupération
  - Livraison
  - À emporter
  - Sur place
- **Paiement** : Intégration de plusieurs méthodes de paiement
- **Suivi** : Suivi en temps réel des commandes
- **Profil** : Gestion du profil utilisateur

## 🔌 API Backend

L'application se connecte au backend NestJS sur `http://localhost:3000/api/v1`.

### Endpoints principaux
- Authentification : `/auth/*`
- Commerces : `/businesses/*`
- Commandes : `/orders/*`
- Paiements : `/payments/*`

## 🎨 Technologies

- **React 18** : Framework UI
- **Vite** : Build tool et serveur de développement
- **React Router v6** : Routage
- **Tailwind CSS** : Styling
- **Axios** : Client HTTP
- **Zustand** : Gestion d'état (panier)
- **Lucide React** : Icônes

## 📝 Notes

- L'application ne contient que les fonctionnalités client (Acheteur)
- Les fonctionnalités dashboard (Admin, Merchant, Driver) sont dans un projet séparé
- Le backend NestJS officiel est dans `fasofree-backend`
