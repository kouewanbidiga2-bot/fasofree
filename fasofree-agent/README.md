# FasoFree Launch Director

Agent IA **gratuit** de conseil pour le lancement de FasoFree : recrutement de restaurants, campagnes clients, plan de 30 jours, suivi des prospects. Interface web locale en français, propulsée par les modèles gratuits OpenRouter.

## Prérequis

- Node.js ≥ 20 (déclaré dans `engines`)
- Un compte gratuit [openrouter.ai](https://openrouter.ai)

## Démarrage en 3 commandes

```bash
cd fasofree-agent
npm install
npm start
```

Puis ouvrez **http://localhost:3000**.

## Étape obligatoire : votre clé OpenRouter

1. Connectez-vous sur openrouter.ai → **Keys** → **Create Key** (nom : `fasofree-launch-agent`).
2. Copiez la clé dans le fichier `.env` :

   ```
   OPENROUTER_API_KEY=sk-or-votre_cle
   ```

3. Jamais de clé dans le code ni dans GitHub (`.env` est ignoré par git).

Le routeur `openrouter/free` ne sélectionne **que** des modèles gratuits : aucun risque de facturation. Limite gratuite : 50 requêtes/jour (1 000/jour si vous achetez ≥ 10 crédits).

## Fichiers de données

| Fichier | Rôle | Versionné ? |
|---|---|---|
| `fasofree-data.json` | Données officielles (ville, budget, zones, offres) | non — copie locale de l'exemple |
| `restaurants.json` | Prospects restaurants (statuts, relances) | non (données personnelles) |
| `clients.json` | Prospects clients | non (données personnelles) |
| `*.example.json` | Templates à copier | **oui** |

Après un clone, recréez vos fichiers de données :

```bash
copy fasofree-data.example.json fasofree-data.json
copy restaurants.example.json restaurants.json
copy clients.example.json clients.json
```

Ces fichiers sont injectés dans le prompt système : l'agent utilise **vos** chiffres, jamais d'inventés.

## Base de données : SQLite ou PostgreSQL

- **Sans `DATABASE_URL`** (local) : SQLite automatique dans `data/agent.db` (node:sqlite, zéro dépendance).
- **Avec `DATABASE_URL`** (hébergement) : PostgreSQL — les tables `conversations`, `messages`, `memories` sont créées au démarrage (vérifié sans collision avec les entités du backend FasoFree). Fuseau UTC forcé, TLS négocié automatiquement sauf sur localhost.

Les deux modes partagent les mêmes requêtes ; l'historique et le business plan survivent aux redéploys grâce à la base.

## Authentification (APP_PASSWORD)

Si la variable `APP_PASSWORD` est définie, l'API exige un cookie de session :

1. l'application affiche un écran de connexion ;
2. `POST /api/auth` vérifie le mot de passe (comparaison en durée constante sur SHA-256) et pose un cookie `HttpOnly` (7 jours) ;
3. 5 échecs → blocage 15 minutes par IP ;
4. sans `APP_PASSWORD`, l'accès reste libre (développement local).

## Hébergement (Render)

Créez un service **Web** (start command `npm start`) et renseignez les variables d'environnement :

| Variable | Rôle |
|---|---|
| `OPENROUTER_API_KEY` | obligatoire — clé openrouter.ai |
| `DATABASE_URL` | URL externe de ta PostgreSQL FasoFree (« Internal/External Database URL ») |
| `APP_PASSWORD` | mot de passe de l'écran de connexion (fortement recommandé : l'API est publique sinon) |
| `PORT` | fourni automatiquement par Render |

Le disque local est éphémère sur Render : **tout passe par `DATABASE_URL`**, sinon historique et business plan sont perdus au redéploy. Pensez à ajouter `?options=-c%20TimeZone%3DUTC` si votre URL ne l'a pas déjà (sinon le serveur l'ajoute).

## Endpoints

- `POST /api/chat` — `{ "message": "...", "conversationId": 1 }` → `{ "answer": "...", "conversationId": 1, "title": "...", "memories": [...] }`
  - `conversationId` facultatif : absent/créé → nouvelle conversation, sinon poursuite de la conversation existante (contexte des ~20 derniers messages).
  - `memories` : notes ajoutées au business plan pendant cet échange (vide si rien).
- `GET /api/conversations` — liste des conversations (titre, dates, nombre de messages)
- `GET /api/conversations/:id` — messages d'une conversation
- `DELETE /api/conversations/:id` — supprime la conversation (et ses messages)
- `GET /api/memories` — notes du business plan (dernières 200)
- `POST /api/memories` — `{ "content": "..." }` — ajout manuel (dédoublonnage automatique)
- `DELETE /api/memories/:id` — supprime une note
- `POST /api/reset` — conservé pour compatibilité (l'historique est désormais en base)
- `GET /api/status` — clé configurée ? données présentes ?

## Historique

Les conversations sont persistées en **SQLite** (`data/agent.db`, base créée automatiquement, ignorée par git) via `node:sqlite` — aucune dépendance de plus. Le panneau de la barre latérale contient deux onglets : **Historique** (rouvrir/supprimer une conversation, recherche) et **Business Plan** (notes de l'agent).

## Business Plan : la mémoire de l'agent

L'agent retient les décisions stables du plan et les réutilise à chaque requête (40 dernières notes injectées dans le prompt système).

Deux façons de mémoriser :

1. **Dire à l'agent** : « retiens que… », « note que… », « souviens-toi que… ». L'extraction est faite côté serveur, et l'agent peut aussi émettre lui-même des marqueurs `[RETIENS]` (jamais affichés dans la réponse). Reformulations doublons ignorées (similarité de tokens).
2. **Ajout manuel** : onglet Business Plan → champ de saisie, ou `POST /api/memories`.

Chaque note est visible, datée et supprimable dans le panneau.

## Animations

Au lancement, un splash animé dessine le masque FasoFree (GSAP, réutilisable au clic pour passer). Pendant l'attente d'une réponse, un indicateur « Réflexion en cours » affiche le masque miniature en orbite. Si GSAP est absent ou si `prefers-reduced-motion` est actif, l'interface bascule sur un repli CSS simple.

## Exemples de demandes

- « Nous voulons lancer FasoFree à Ouagadougou dans 30 jours avec 300 000 FCFA. Prépare un plan. »
- « Quels restaurants devons-nous contacter cette semaine ? »
- « Prépare une offre pour convaincre les restaurants de Ouagadougou. »
- « Crée une campagne pour obtenir 500 premiers clients. »
- « Écris un message WhatsApp pour recruter les livreurs. »

## Garde-fous

L'agent **n'est jamais autorisé** à dépenser de l'argent, publier une campagne ou inscrire un restaurant sans validation humaine. Aucune statistique de performance n'est inventée : sans donnée, l'agent le dit explicitement.
