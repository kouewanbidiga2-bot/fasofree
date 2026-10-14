# Plan d'action v2 — Dispatch multi-niveaux (Delivery Providers / Fallback)

> Document de travail — **non commité** (untracked). Revu le 06/10/2026 à partir du
> retour d'évaluation (scorecard + architecture multi-niveaux) intégré au plan v1.
> Statut : **proposition en attente de feu vert pour la Phase 0.**

---

## 1. Problème

FasoFree manque de livreurs actifs ⇒ des commandes restent sans prestataire malgré un
dispatch temps réel fonctionnel. Le système sait **distribuer une course quand un
livreur existe**, mais il ne sait pas **garantir la livraison quand aucun livreur
n'est disponible** : « aucun livreur » est aujourd'hui traité comme fin de course.

## 2. État des lieux (code — vérifié le 30/09/2026)

| Bloc | Évaluation | Commentaire |
|---|---|---|
| Scoring des livreurs | 🟢 8.5/10 | distance 60 % + note 40 %, contraintes vélo, ≤10 km |
| Anti-course-pillée | 🟢 9.5/10 | `SERIALIZABLE` + `pessimistic_write` sur accept |
| Expiration / retry | 🟢 8/10 | top 3 → 10 min → candidat suivant → 5 min → alerte marchand (cron/min) |
| GPS temps réel | 🟢 9/10 | Redis Geo + persistance DB throttlée + trace (50 pts) + broadcast |
| Validation livraison | 🟢 9/10 | double étape livreur + PIN client |
| Paiements | 🟢 9/10 | séquestre 3 h, index unique anti-double-payout, réconciliation 5 min |
| Résilience du dispatch | 🟠 5/10 | dépendance forte aux livreurs internes |
| Scalabilité | 🟠 6/10 | le pool local est le goulot |
| **Gestion « aucun livreur »** | 🔴 **3/10** | **le trou fonctionnel à corriger** |

Hiérarchie réelle des fichiers :
- `dispatch/dispatch.service.ts` · `autoDispatchOrder` (déclenché depuis `orders.service.ts:774/1816`), `findAndScoreDrivers`, `checkDispatchTimeouts` (cron), `assignDriverToOrder`.
- `dispatch/dispatch.gateway.ts` · `targeted_order_offer`, `delivery_opportunity`, broadcast statuts.
- `dispatch/dispatch.controller.ts` · `accept` (SERIALIZABLE), `refuse`, `available`.
- `orders/dispatch.service.ts` · `GeoDispatchService` (Redis Geo, rayons 3/5/10 km, RIDE/P2P).
- `orders/orders.service.ts` · FSM, `driverValidateDelivery`, `clientValidateWithPin`, settlement gains + payouts.

## 3. Constat marché (vérifié le 30/09/2026)

- Aucune société de livraison locale du Burkina ne publie d'API aujourd'hui
  (GOExpress.BF, Tic Tac, ProColis = téléphone / WhatsApp).
- **DAGO Express = fournisseur européen** (France/Europe) — API inutilisable au Burkina.
- ⇒ Le levier immédiat de personnel = **modèle Agences** (flottes locales) ; l'abstraction
  multi-providers prépare l'avenir.

## 4. Architecture cible — `DispatchService` devient **orchestrateur multi-niveaux**

Principe fondateur :

> **« Le dispatch interne a échoué » n'est pas une erreur finale → passage au niveau de secours suivant.**

### 4.1 Les 4 niveaux d'escalade

```
READY_FOR_PICKUP
      ↓
DISPATCH ENGINE (orchestrateur)
      ↓
┌───────────────────────────────┐
│ LEVEL 1 — Livreurs internes   │  top 3 → 10 min → retry (cron) → candidat suivant
│                               │
│   (existe déjà — à conserver) │
├───────────────────────────────┤
│ LEVEL 2 — Agences partenaires │  provider A → B → C (flottes par zone)
│                               │
│   (à construire — le levier)  │
├───────────────────────────────┤
│ LEVEL 3 — Providers tiers     │  diffusion élargie / API partenaire (quand elle existe)
├───────────────────────────────┤
│ LEVEL 4 — Intervention humaine│  marchand / support / dispatcher (dashboard dédié)
└───────────────────────────────┘
      ↓ (échec de tous les niveaux)
  NOTIFICATION EXPLICITE + SLA dépassé tracé
```

### 4.2 Séquence SLA (calibrage à confirmer opérationnellement)

| Temps | Événement |
|---|---|
| T+0 | `READY_FOR_PICKUP` → dispatch interne |
| T+0 → T+5 | Niveau 1 : top 3 candidats internes |
| T+5 → T+10 | Niveau 1 retry : candidat suivant |
| T+10 | Niveau 2 : provider externe (agence) |
| T+15 | Niveau 3 : provider secondaire |
| T+20 | Niveau 4 : escalade support/dispatcher |

### 4.3 Séparation **Provider / Driver** (principale règle d'architecture)

Ne jamais mélanger provider et driver. Le moteur ne demande plus
« quel livreur est disponible ? » mais
**« quel moyen de livraison satisfait cette commande au meilleur coût/SLA ? »**

```
DispatchOrder
      ↓
DispatchProvider   ← choisi par l'orchestrateur (scoring de provider)
      ↓
Driver             ← choisit sa course (niveau interne) ou est assigné (agence/manuel)
```

Modèle de données Provider :

```
Provider
├── type : INTERNAL | AGENCY | THIRD_PARTY
├── drivers (relation — si flotte interne/agence)
├── zones (couverture géographique)
├── tarifs (prix/course ou % commission)
├── SLA (temps de prise en charge, fiabilité)
└── disponibilité (actif, capacité max en vol, heures)
```

### 4.4 Ce qui est déjà en place vs à construire

| Élément | État |
|---|---|
| Niveau 1 (dispatch interne) | ✅ Existant — **à conserver, pas réécrire** |
| Acceptation anti-pillée | ✅ Existant |
| Paiements / reciprocation | ✅ Existant |
| Orchestrateur + fail-over inter-niveaux | ❌ À construire (Phase 0) |
| Modèle Provider (type/zones/tarifs/SLA) | ❌ À construire |
| Niveau 2 (agences) | ❌ À construire (Phase 1) |
| Niveau 4 (escalade humaine dashboard) | 🟠 Partiel : alerte marchand + assign manuel existent ; manque l'écran dispatcher + timers SLA |
| Scoring v2 (ETA multi-facteurs) | ❌ À construire (évolution) |

## 5. Évolution du scoring

- **Aujourd'hui** : `distance 60 % + note 40 %` (Haversine, coords DB) — simple, efficace, à conserver en v1 du nouvel orchestrateur.
- **Cible** : ETA plutôt que distance brute, multi-facteurs :

```
SCORE =
  35 % distance/ETA
+ 20 % disponibilité
+ 15 % fiabilité
+ 10 % taux d'acceptation
+ 10 % qualité (note)
+ 10 % coût
```

- ⚠️ **Dépendance à trancher** : un vrai ETA exige une source de données routières
  (OSRM / OpenRouteService gratuits, ou Google Directions payante + clé).
  Impact : dépendance npm nouvelle possible + clé API → à valider avant la Phase 4.

## 6. Plan d'implémentation (phasé, sans réécrire le moteur)

### Phase 0 — Socle orchestrateur + abstraction Provider (zéro changement de comportement)
- `dispatch/providers/delivery-provider.interface.ts` : `type`, `zones`, `createDelivery(ticket)`, `track(ref)`, `cancel(ref)`, `canHandle(order)`.
- `dispatch/providers/delivery-provider.registry.ts` : ordre depuis `DELIVERY_PROVIDERS=internal_flotte,agence,manuel`.
- `internal-fleet.provider.ts` : **wrapper** du dispatch existant (aucune réécriture).
- `manual.provider.ts` : opérateur → partenaire (tél/WhatsApp) + saisie ref/statuts.
- Migration + colonnes `orders` : `deliveryProvider`, `deliveryExternalRef`, `deliveryProviderStatus`, `deliveryProviderTriedAt`, `deliveryProviderDetails (jsonb)`.
- Fail-over branché sur `autoDispatchOrder` + cron (0 candidat → provider suivant).
- Env : `DELIVERY_PROVIDERS`, `DISPATCH_TIMEOUT_MS` (rendu configurable, défaut 600 000).

### Phase 1 — Niveau 2 : Agences (levier personnel — recommandé)
- Entité `delivery-agency` (zones, commission, actif) + rôle `AGENCY` + room WS + dashboard : reçoit les courses routées, assigne à **ses** chauffeurs.
- Débordement inter-niveaux 1→2 branché sur le registry.
- Commission agence en % (configurable).

### Phase 2 — Niveau 2/3 : providers tiers + bridge manuel
- Mettre `manual.provider` en prod (GOExpress/WhatsApp).
- Adaptateur HTTP + **webhook HMAC** pour le 1er partenaire avec API (contrat signé requis).

### Phase 3 — Niveau 4 : escalade opérationnelle
- Écran dispatcher (support/admin) : file des commandes en SLA dépassé, assign manuel 1 clic, horodatage SLA.
- Timers SLA (T+10/T+15/T+20) visibles dans le dashboard marchand aussi.

### Phase 4 — Scoring v2 (ETA multi-facteurs)
- Après décision sur la source de données routières.

## 7. Sécurité (dès le socle)

- Webhooks partenaires **signés HMAC** (`*_WEBHOOK_SECRET`), payloads non fiables.
- **Jamais de contenu (adresses, client, SMS) dans les logs** (leçon SMS déjà appliquée).
- Isolation par zone/agence : une agence ne voit que ses courses.

## 8. Décisions ouvertes (avant/blocs de départ)

- [ ] Feu vert Phase 0 seule, ou Phase 0 + Phase 1 ensemble ?
- [ ] Calibration des timers SLA (T+5/T+10/T+15/T+20) — proposition initiale à confirmer.
- [ ] Commission agence (ex. 10 % ? 15 % ?) — décision commerciale.
- [ ] Zones cibles (Ouaga seul ou Bobo aussi ?).
- [ ] Source de données pour ETA (OSRM/OpenRouteService gratuit vs Google payant) — pour Phase 4 seulement.
- [ ] Contacter des agences/moto-taxis dès maintenant ?
- [ ] Qui gère « manual.provider » en prod (équipe support ?).

## 9. Implémentation (au feu vert)

Process habituel : tsc + eslint + prettier, revue code-reviewer avant commit, commit
scopé, `.env*` jamais commités, aucune dépendance npm nouvelle (sauf Phase 4 si décidée —
`package-lock.json` interdit sinon). Variables attendues sur Render :
`DELIVERY_PROVIDERS`, `DISPATCH_TIMEOUT_MS`, `DELIVERY_AGENCY_COMMISSION_PCT`, secrets webhooks.