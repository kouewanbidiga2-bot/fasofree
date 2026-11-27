# FasoFre — Phase 2 : architecture opérationnelle du dispatch

## 1. Décision produit

FasoFre est une plateforme de mise en relation et d'exécution de livraisons.
Elle ne vend pas de repas et ne possède pas de catalogue alimentaire.

Un client ou un commerce peut demander :

- l'envoi d'un colis ;
- la récupération d'une commande déjà payée chez un commerçant ;
- la livraison d'un document, d'un achat ou d'un autre objet autorisé ;
- une course VTC, dans le module mobilité séparé.

Pour une récupération de commande, le commerce ou le client renseigne le lieu de récupération. FasoFre ne crée pas la commande du commerçant : la plateforme exécute uniquement le transport.

## 2. Acteurs

### Émetteur

La personne ou le commerce qui demande la livraison. Il renseigne le point de récupération, le destinataire, la description du colis et les instructions.

### Récepteur

La personne qui reçoit le colis. Il peut suivre la livraison avec un lien sécurisé ou depuis son compte. Seul le récepteur peut confirmer la réception finale.

### Livreur

Un livreur indépendant ou un livreur appartenant à une société partenaire. Il doit être approuvé, disponible et connecté pour recevoir les missions.

### Société partenaire

Une entreprise de livraison qui inscrit sa structure, ses responsables et sa flotte. Elle peut recevoir des missions et suivre ses livreurs selon les permissions accordées.

### FasoFre

La plateforme centralise l'attribution, le paiement, le suivi, les preuves de livraison, le support, les litiges et les règlements aux livreurs ou sociétés.

## 3. Création d'une livraison

Le formulaire client doit demander :

1. adresse ou position du lieu de récupération ;
2. nom et téléphone du contact au lieu de récupération ;
3. adresse ou position de destination ;
4. nom et téléphone du récepteur ;
5. type de livraison : colis, commande déjà passée, document ou autre ;
6. description, poids estimé et caractère fragile ;
7. livraison immédiate ou programmée ;
8. instructions et repère local ;
9. mode de paiement ;
10. acceptation des conditions et du prix.

Pour une commande déjà passée, le champ « référence de commande » est facultatif mais recommandé. Il ne remplace jamais la description du colis.

## 4. Statuts officiels

```text
DRAFT
  -> QUOTE_READY
  -> PAYMENT_PENDING
  -> PAID
  -> OPEN_FOR_ACCEPTANCE
  -> CLAIMED
  -> AT_PICKUP
  -> PICKED_UP
  -> IN_TRANSIT
  -> ARRIVED_AT_DESTINATION
  -> DELIVERED_CONFIRMED
```

États d'exception :

- `CANCELLED_BY_SENDER` : annulation autorisée selon les règles tarifaires ;
- `RECIPIENT_UNAVAILABLE` : le livreur est arrivé mais ne peut pas remettre le colis ;
- `PICKUP_FAILED` : le colis n'était pas disponible au lieu de récupération ;
- `DISPUTED` : un litige est ouvert ;
- `FAILED` : échec technique ou opérationnel nécessitant le support.

Le livreur ne peut jamais passer directement à `DELIVERED_CONFIRMED`. Il peut déclarer son arrivée et demander le code de réception. La confirmation finale est réservée au récepteur ou au support autorisé après vérification.

## 5. Attribution aux livreurs

### Déclenchement

Après paiement confirmé, la livraison passe à `OPEN_FOR_ACCEPTANCE`. Le backend sélectionne les livreurs :

- approuvés et non suspendus ;
- en ligne ;
- dont la dernière position est récente ;
- à proximité du lieu de récupération ;
- dont la capacité de missions n'est pas atteinte ;
- compatibles avec le type, le poids et la fragilité du colis.

### Première acceptation gagnante

La mission est visible par plusieurs livreurs, mais un seul peut la prendre.

Le premier clic accepté par le backend verrouille la livraison. L'opération doit être atomique :

```text
si statut = OPEN_FOR_ACCEPTANCE et livreur_id est vide
  alors affecter le livreur et passer à CLAIMED
sinon
  refuser la prise et afficher « Mission déjà attribuée »
```

L'interface ne doit jamais considérer le simple clic comme une attribution définitive. Seule la réponse confirmée du serveur fait foi.

### Extension de la zone

- première vague : livreurs dans un rayon de 2 km autour du lieu de récupération ;
- après expiration d'un délai court configurable : élargissement progressif ;
- si aucun livreur n'accepte : affectation manuelle par le support ou une société partenaire.

Les rayons et délais seront configurables dans le dashboard, sans modification du code.

## 6. Cumul de livraisons

La règle de départ recommandée est :

- maximum **3 livraisons actives** par livreur dans une même zone opérationnelle ;
- une zone correspond à une cellule géographique ou à un rayon configuré, recommandé à 2 km au pilote ;
- une mission urgente ou programmée ne peut pas être cumulée si le délai estimé devient incompatible ;
- le livreur doit voir l'ordre conseillé des missions ;
- le système refuse automatiquement une quatrième mission compatible en apparence.

Pour le MVP, on applique une règle simple et contrôlable : maximum trois missions actives, même zone, même créneau, sans conflit de délai. L'optimisation avancée des itinéraires viendra après les mesures terrain.

## 7. Suivi émetteur et récepteur

### Émetteur

Il voit :

- le statut de la livraison ;
- le livreur attribué ;
- la position approximative puis la position en cours de trajet ;
- l'heure estimée ;
- le fil des événements ;
- le contact support et, lorsque la mission est active, le contact sécurisé du livreur.

### Récepteur

Il reçoit un lien de suivi en lecture seule par SMS ou WhatsApp. Le lien contient un jeton temporaire et ne donne pas accès au compte de l'émetteur.

Il voit les mêmes étapes utiles au transport, mais ne peut pas modifier l'adresse, le prix ou le livreur. Il possède la seule action finale :

```text
Saisir le code OTP de réception
  -> contrôler le code côté serveur
  -> enregistrer la date, le téléphone et le livreur
  -> passer à DELIVERED_CONFIRMED
  -> déclencher le règlement du livreur
```

Si le récepteur est absent, le livreur choisit `RECIPIENT_UNAVAILABLE` et ajoute une note ou une preuve. Il ne valide pas lui-même la réception.

## 8. Paiement et règlement

Le modèle recommandé est le paiement centralisé :

1. l'émetteur paie FasoFre au moment de la confirmation ;
2. la livraison n'est ouverte aux livreurs qu'après confirmation du paiement, sauf exception contrôlée par le support ;
3. FasoFre conserve le montant pendant l'exécution ;
4. le récepteur confirme la réception par OTP ;
5. le montant du livreur ou de la société devient payable ;
6. les frais et la commission FasoFre sont enregistrés séparément.

Les moyens de paiement peuvent inclure Orange Money, Moov Money, Wave et le paiement à la livraison si cette exception est activée par zone. Le paiement à la livraison doit rester une règle contrôlée, car il réduit la protection contre les annulations et les litiges.

## 9. Localisation et consommation de données

La localisation permanente n'est pas nécessaire pour le client ou le récepteur. Elle est nécessaire pour le livreur uniquement lorsqu'il est en ligne ou qu'il exécute une mission.

### Stratégie de données du MVP

- position envoyée seulement lorsque le livreur est disponible ou en mission ;
- intervalle adaptatif : plus fréquent en mouvement, moins fréquent à l'arrêt ;
- dernière position et heure de mise à jour affichées dans le dashboard ;
- arrêt automatique du partage après la fin ou l'annulation de la mission ;
- envoi de petits paquets JSON, sans images ni cartes complètes ;
- navigation routière ouverte dans Google Maps ou une autre application déjà utilisée par le livreur ;
- la carte FasoFre sert au dispatch et au suivi, pas au remplacement immédiat de l'application de navigation.

Une PWA seule ne doit pas être considérée comme suffisamment fiable pour un suivi continu en arrière-plan. Android limite les mises à jour des applications en arrière-plan et recommande un service au premier plan lorsque le temps réel est indispensable. iOS exige une configuration spécifique des mises à jour de localisation en arrière-plan. L'app livreur devra donc être empaquetée en application mobile native ou hybride avec un service de localisation adapté ; l'app client peut rester une PWA.

## 10. Authentification et notifications

### Authentification

- SMS OTP comme méthode principale, car il couvre tous les utilisateurs ;
- WhatsApp comme canal complémentaire lorsqu'il est disponible et consenti ;
- email utilisé pour les confirmations KYC/KYB, les reçus et les alertes importantes ;
- ne jamais envoyer le code de validation ou le lien privé dans un message non sécurisé.

### Notifications

Le même événement peut produire plusieurs canaux, selon les préférences :

- push dans l'application ;
- SMS ;
- WhatsApp Business ;
- email.

Événements prioritaires : livraison créée, paiement confirmé, mission attribuée, livreur en route, arrivée, code de réception, livraison confirmée, incident et remboursement.

WhatsApp doit être intégré par la WhatsApp Business Platform avec des modèles approuvés et des webhooks. Il ne faut pas dépendre d'un simple compte WhatsApp personnel pour le fonctionnement critique.

## 11. Onboarding KYC/KYB

### Livreur indépendant — KYC

- identité et téléphone vérifiés ;
- pièce d'identité ;
- permis ou justificatif requis selon le véhicule ;
- carte grise et assurance si nécessaire ;
- photo de profil ou selfie de contrôle ;
- moyen de paiement pour les règlements ;
- statut : `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `SUSPENDED`.

### Société de livraison — KYB

- raison sociale ;
- registre ou document légal de l'entreprise ;
- identifiant fiscal si applicable ;
- représentant autorisé ;
- adresse et téléphone ;
- moyen de règlement ;
- liste des livreurs et véhicules ;
- contrat ou conditions de collaboration FasoFre.

La validation est manuelle dans la première version. Après décision, le demandeur reçoit un email, un message WhatsApp si disponible et une notification dans son espace.

## 12. Ordre de développement

### Étape A — App client

1. écran d'accueil livraison ;
2. création de livraison ;
3. choix du lieu de récupération et de la destination ;
4. devis et paiement ;
5. suivi émetteur ;
6. lien de suivi récepteur ;
7. code OTP de réception ;
8. historique, support et litiges.

### Étape B — App livreur

1. inscription et KYC ;
2. disponibilité en ligne/hors ligne ;
3. alertes de missions proches ;
4. acceptation verrouillée ;
5. cumul contrôlé de trois missions ;
6. navigation externe ;
7. arrivée, récupération, trajet et remise ;
8. revenus et historique.

### Étape C — Dashboard équipes

- dispatch en direct ;
- carte des livraisons et livreurs ;
- affectation et reprise manuelle ;
- gestion des sociétés partenaires ;
- validation KYC/KYB ;
- paiements, commissions et règlements ;
- incidents, litiges et preuves ;
- campagnes et notifications ;
- statistiques opérationnelles.

## 13. Règles de sécurité non négociables

- le serveur décide toujours de l'attribution ;
- une livraison ne peut avoir qu'un livreur actif ;
- l'émetteur et le récepteur ne peuvent pas modifier le statut de livraison ;
- seul le récepteur ou le support autorisé peut confirmer la réception ;
- les liens de suivi sont temporaires et révocables ;
- le téléphone personnel du livreur n'est jamais exposé sans relais ou masquage ;
- chaque changement de statut et chaque paiement sont journalisés ;
- le partage de localisation s'arrête dès que la mission est terminée.

