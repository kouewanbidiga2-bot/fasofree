# FasoFree

## Présentation

FasoFree est une plateforme marketplace et livraison pensée pour le Burkina Faso : commande de repas et de produits chez les commerçants locaux, courses (transport de personnes), livraison de colis entre particuliers, et un back-office permettant de piloter l'ensemble.

Projet réalisé à deux (342 commits) : plus de 67 000 lignes de code, 37 controllers et plus de 200 endpoints répartis sur trois applications — une app grand public, un espace d'administration multi-rôles et une API centrale.

## Objectif

Réunir dans un seul service ce qui est aujourd'hui dispersé : commander chez un commerçant du quartier, se faire livrer, envoyer un colis, réclamer en cas de litige.

Le problème traité est l'absence d'un outil local couvrant toute la chaîne : commande, livraison, paiement mobile money, gestion des litiges et suivi des livreurs. L'ambition est de donner aux commerçants, livreurs et clients un socle commun, avec un tableau de bord adapté à chaque rôle plutôt qu'un seul écran générique.

## Fonctionnalités

Côté application client :

- Accueil et catalogues (restaurants, produits), recherche et favoris
- Panier, checkout et reçu de commande
- Suivi de commande en temps réel
- Réservation de course (transport de personnes)
- Livraison de colis entre particuliers, en plusieurs étapes
- Gestion des litiges et remboursements
- Programme VIP, adresses enregistrées, stories
- Assistant vocal et commande par la voix
- Interface multi-langues

Côté administration (back-office multi-rôles) :

- Vue globale, pilotage des commandes en direct (live orders)
- Validation KYC, gestion des utilisateurs et des demandes de bannissement
- Gestion des litiges et messagerie interne (équipe, support, dispatch)
- Espace marchand : commandes, stock et catalogue, stories, paramètres
- Espace livreur : courses, gains, historique
- Gestion des abonnements, des marques et des agences
- Tableaux de bord statistiques et carte (Leaflet)

## Technologies

Frontend :

- React 18, Vite, React Router, Tailwind CSS
- Zustand (état), axios, clsx / tailwind-merge
- Leaflet + react-leaflet (cartes), recharts et lightweight-charts (graphiques)
- socket.io-client (temps réel), Sonner (notifications), Firebase (push web)

Backend et infrastructure :

- NestJS 11 + TypeScript, PostgreSQL + TypeORM, Redis
- Socket.IO, cron (dispatch, purges, wallets), EventEmitter
- JWT + Passport + bcrypt, Helmet, Throttler (rate limiting)
- S3 et Cloudinary, Resend, Firebase Admin, WhatsApp API, Sentry, Swagger
- Paiement GeniusPay / Orange Money
- Déploiement : API sur Render (Docker, migrations au boot), fronts sur Vercel

## Architecture

```
        ┌─────────────────────────┐
        │   App client (Vercel)   │  fasofree.site
        │   React + Vite          │
        └───────────┬─────────────┘
                    │
        ┌───────────┴─────────────┐
        │  Back-office (Vercel)   │  admin.fasofree.site
        │  Dashboards multi-rôles │
        └───────────┬─────────────┘
                    │  REST + WebSocket
        ┌───────────┴─────────────┐
        │   API (Render, Docker)  │  api.fasofree.site
        │   NestJS + TypeORM      │
        ├─────────────────────────┤
        │  PostgreSQL   Redis     │
        └─────────────────────────┘
```

## Équipe et contributions

Projet conçu et développé par deux personnes. 342 commits au total : 190 pour Franck Rayan Bado, 152 pour BIDIGA Imrane.

### Franck Rayan Bado — co-développeur

**Application client** :

- Inscription et connexion, gestion du compte et des adresses
- Catalogues, recherche et favoris, panier, checkout et reçu de commande
- Suivi de commande en temps réel
- Réservation de course et livraison de colis entre particuliers
- Litiges côté client, programme VIP, stories
- Assistant vocal et commande par la voix
- Support multi-langues

**Paiements et wallets** :

- Intégration GeniusPay de bout en bout : initiation et consultation de paiement, vérification de webhook, idempotence, contrôle de montant, retrait sur `FAILED`, nettoyage des commandes expirées, confirmation en cash immédiate, cron purge les commandes en attente au-delà de 30 minutes
- Portefeuilles : modèle hold/release, cashout déclenché par webhook, wallet super-admin, vue agrégée, workflow de retrait manuel avec destinataire obligatoire, correctifs de propriétés `branchId` / `ownerId`
- Endpoint de réparation des wallets créés avec le mauvais rôle (livreur au lieu de marchand)
- Tranches tarifaires de livraison configurables depuis le dashboard super-admin, surcharge nocturne, position GPS obligatoire

**Logique métier API — commandes, dispatch et temps réel** :

- Machine à états des commandes (transitions, y compris attente de paiement)
- Dispatch : verrou transactionnel à l'acceptation, passage du livreur en indisponible, timeout de 10 minutes sur la phase de récupération, relais vers le livreur suivant en cas de refus
- Diffusion WebSocket de tous les changements de statut vers les clients connectés

**Onboarding, KYC et approbation** :

- Bug racine « marchand approuvé mais invisible » : incompatibilité entre les statuts de candidature et de KYC, corrigée et vérifiée par un scénario de bout en bout (candidature → validation KYC → approbation → commerce visible)
- CNI obligatoire à l'inscription (et permis pour les livreurs)
- Scission du compte super-admin / compte collaborateur gérée par migration
- Verrous super-admin (non bannissable, non supprimable) en code et en triggers PostgreSQL ; correction d'un trigger `DELETE` qui annulait silencieusement les suppressions d'utilisateurs
- Bootstrap du super-admin au démarrage et réinitialisation de mot de passe par e-mail

**Correction et fiabilisation des dashboards** :

- Correction du spam de sockets et des tableaux de bord qui bouclaient (milliers d'erreurs en console) : connexion non automatique, sélecteurs d'état ciblés, rafraîchissement au retour d'onglet
- Guard des rôles : les livreurs n'entrent plus dans les dashboards admin
- Correctif de la 500 sur la liste des commandes admin (jointure SQL cassée)
- Pièces jointes KYC consultables depuis les quatre dashboards : URLs Cloudinary signées et aperçu PDF
- Interface des candidatures (statuts, validation, liste des dossiers)

**SQL, migrations et documentation** :

- Migrations SQL compatibles PostgreSQL (casts, identifiants entre guillemets), colonnes manquantes sur les commandes, seeds
- Plusieurs passes d'audit et de correction de bugs (20, 21 puis 11 anomalies, dont 7 sur les wallets et payouts et 11 sur les paiements)
- Stories (propriété des suppressions, cron d'expiration), transfert de propriété d'un commerce, corrections multi-agences
- Documentation technique et Swagger

### BIDIGA Imrane — co-développeur

**Audit et sécurisation** :

- Audit de sécurité complet : failles critiques à moyennes (JWT fail-fast, fuite de mot de passe temporaire, XSS dans les e-mails, PIN de livraison crypté, CORS et Swagger en production, OTP masqué, webhooks fail-closed, contrôles d'appartenance, index manquants)
- Mise en place de l'intégration continue et verrouillage du seed en production

**Notifications multicanal** :

- Resend, WhatsApp Meta Cloud API (webhook vérifié), SMS, Firebase FCM (service worker et push)
- Relais Gmail SMTP en secours, diagnostic IPv4 (correctif ENETUNREACH sur Render)

**Stockage et images** :

- Cloudinary avec repli sur `CLOUDINARY_URL`, upload côté front avec prévisualisation

**Chat temps réel** :

- Module de chat interne admin avec boîte de réception, chat livreur ↔ client

**Paiements complémentaires** :

- Payouts Mobile Money (retraits, frais dynamiques), YengaPay (PaymentIntent + webhook HMAC, TELECÉL MONEY)

**Interface et domaine** :

- Mode invité, six dashboards unifiés, chargement des images sans clignotement, PWA et favicon, thème sombre, favoris, centre de notifications
- Import de catalogue depuis PDF via IA
- Migration du domaine vers `fasofree.site` / `api.fasofree.site`, CORS multi-origines, configuration Vercel

### Développé conjointement

- Les six dashboards d'administration : interface et unification (Imrane), correction des bugs et fiabilisation (Franck)
- Le parcours d'onboarding marchand et livreur, de l'inscription à l'activation
- Les remontées de bugs et corrections de production, en alternance

## Démonstration

- App client : https://fasofree.site
- Back-office : https://admin.fasofree.site
- API : https://api.fasofree.site

## Limites / améliorations

- **Fichiers-monolithes côté dashboard** : certains écrans d'administration dépassent 1 500 à 2 800 lignes, avec état, appels API et rendu mélangés. Une séparation en hooks et sous-composants rendrait le tout bien plus maintenable.
- **Couverture de tests inégale** : le back-end possède des tests unitaires et un test de bout en bout, mais les deux applications React n'ont aucun test automatisé.
- **Dette de lint** : l'administration déclare un script `lint` sans fichier de configuration correspondant, l'application client n'a ni lint ni test, et le lint back n'est pas bloquant en intégration continue.
- **Documentation en retard sur le code** : `PROJECT_BIBLE.md` se déclare lui-même obsolète et contient encore des comptes de test et des valeurs d'exemple qui doivent être retirés.
- **Hygiène du dépôt** : un binaire de test de charge est versionné en double et représente l'essentiel de la taille du dépôt ; l'historique contient des éléments de configuration qui doivent être purgés.
- **Accessibilité et performances** : les écrans d'administration chargent beaucoup de données d'un coup ; une pagination et un chargement progressif amélioreraient nettement l'usage quotidien.
