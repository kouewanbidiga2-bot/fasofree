# 📚 FasoFree Legal & Compliance Pack

> **Pack contractuel et de conformité de la plateforme FasoFree** (Burkina Faso).
> Statut global : **V1.0 — à faire relire et valider par un avocat / notaire au Burkina Faso avant mise en production.**

---

## 1. Pourquoi ce pack

FasoFree traite des données sensibles et variées : **géolocalisation (continue pour les livreurs), identité, téléphone, historique de commandes, paiements, données de commerçants et de livreurs, espèces encaissées, documents d'identité**. Un simple jeu de CGU génériques ne suffit pas : le dispositif est conçu comme **un ensemble documentaire cohérent, numéroté et versionné**, afin que le backend puisse enregistrer **exactement quelle version chaque utilisateur a acceptée, quand, et par quel mécanisme** (case à cocher, clic, signature électronique / OTP).

## 2. Arborescence

```
docs/legal/
├── README.md                     ← ce fichier (index + gouvernance des versions)
├── FR-CGU-001.md                 Conditions Générales d'Utilisation (client)            [fourni V1.0]
├── FR-PRIV-002.md                Politique de confidentialité & données personnelles     [fourni V1.0]
├── FR-COOK-003.md                Politique cookies & traceurs                            [V0.9 brouillon]
├── FR-CGV-004.md                 Conditions de vente / commande                          [V0.9 brouillon]
├── FR-PMERC-005.md               Contrat de partenariat commercial (Commerçant)          [fourni V1.0]
├── FR-LIVR-006.md                Contrat-cadre Livreur                                  [fourni V1.0]
├── FR-SECUR-007.md               Charte de sécurité Livreur                             [V0.9 brouillon]
├── FR-RMB-008.md                 Politique de remboursement & d'annulation               [V0.9 brouillon]
├── FR-ANFR-009.md                Politique anti-fraude                                   [V0.9 brouillon]
├── FR-DPI-010.md                 Procédure données personnelles & incidents              [V0.9 brouillon]
└── FR-TAR-011.md                 Annexes tarifaires (matrice)                            [V0.9 brouillon]
```

## 3. Numérotation et codes documentaires

Chaque document porte un **code stable** (`FR-CGU-001`, …) dans son en-tête. Ce code est celui que le **backend enregistre** dans la preuve d'acceptation (cf. §5). La version du document évolue indépendamment de son code : le même code, version `1.1`, signifie une évolution mineure, sans changement de numérotation.

| Code        | Document                              | Audience      | Mécanisme d'acceptation attendu            |
|-------------|---------------------------------------|---------------|---------------------------------------------|
| FR-CGU-001  | CGU                                   | Client        | Case à cocher à la création de compte       |
| FR-PRIV-002 | Politique de confidentialité          | Tous          | Rattachée aux CGU + contrat                 |
| FR-COOK-003 | Politique cookies & traceurs          | Tous          | Consentement des traceurs non nécessaires   |
| FR-CGV-004  | Conditions de vente / commande        | Client        | Validation de commande                      |
| FR-PMERC-005| Contrat commerçant                    | Commerçant    | Signature électronique / OTP                |
| FR-LIVR-006 | Contrat livreur                       | Livreur       | Signature électronique / OTP                |
| FR-SECUR-007| Charte de sécurité livreur            | Livreur       | Case + signature d'entrée en relation       |
| FR-RMB-008  | Remboursement & annulation            | Client/marchand | Rattachement au flux de litiges          |
| FR-ANFR-009 | Anti-fraude                           | Tous          | Renvoi CGU / contrats                       |
| FR-DPI-010  | Données perso & incidents             | Interne + CIL | Procédure interne                           |
| FR-TAR-011  | Annexes tarifaires                    | Commerçant/Livreur | Acceptation de la grille                 |

## 4. En-tête de version (format)

Chaque fichier commence par un bloc de métadonnées destiné à l'horodatage et à l'enregistrement backend :

```yaml
doc: FR-CGU-001
version: 1.0
statut: brouillon-avocat | à-relire | valide
date: 2026-09-27
mecanisme: clic | case-a-cocher | signature-otp
audience: client | commercant | livreur | tous
```

## 5. Protocole d'acceptation & versionnage (backend)

Pour que la preuve d'acceptation soit exploitable par le backend, enregistrer à chaque acceptation au minimum :

| Champ                    | Exemple                                  |
|--------------------------|------------------------------------------|
| `accountId`              | UUID du compte                           |
| `docCode`                | `FR-CGU-001`                             |
| `docVersion`             | `1.0`                                    |
| `acceptedAt`             | horodatage ISO 8601                      |
| `mechanism`              | `case-a-cocher` / `signature-otp`        |
| `source`                 | application / dashboard / web            |
| `ipOrDeviceId` (si légalement requis) | adresse IP ou identifiant technique |

>Toute **modification substantielle** d'un document doit déclencher une **nouvelle acceptation** (nouvelle version) avant la poursuite de l'usage concerné (cf. CGU art. 26, PRIV art. 19).

## 6. Cadre juridique burkinabè de référence

- **Loi n°001-2021/AN du 30 mars 2021** — protection des personnes à l'égard du traitement des données à caractère personnel. Formalités préalables auprès de la **CIL** pour les traitements entrant dans le champ de l'article 26 ; droits d'accès, de rectification, d'opposition.
- **Loi n°045-2009/AN** — transactions électroniques (ARCEP) ; cadre des **services et transactions électroniques** et de la **certification électronique**.
- **Code du travail (2008)** — la qualification de travailleur dépend de la **direction et de l'autorité exercées sur l'activité**, pas du seul titre de « livreur indépendant ». Vérification par un professionnel local impérative.
- **Délibérations CIL** relatives à certains traitements de **géolocalisation** (véhicules/livreurs) : à traiter séparément dans le registre de conformité.
- Droit OHADA / droit de la consommation applicables aux ventes et CGV.

## 7. À compléter avant mise en production (la liste « non-négociable »)

1. [ ] **Identité juridique exacte de FasoFree** : raison sociale, forme juridique, capital, RCCM, IFU, siège, représentant légal, contacts (`[●]` dans tous les documents).
2. [ ] **Matrice tarifaire** (FR-TAR-011) : commission commerçant, frais de service, rémunération livreur, bonus, frais d'annulation, **Seuils Soft/Hard Limit** espèces, délais de règlement.
3. [ ] **Gouvernance des données** (FR-DPI-010) : registre des traitements, durées de conservation par catégorie, sous-traitants exacts, **formalités CIL** (déclaration préalable / autorisation selon l'art. 26).
4. [ ] **Statut juridique des livreurs** — faire valider par un avocat local (analyse de la subordination réelle, pas seulement la clause d'indépendance).
5. [ ] **Géolocalisation continue des livreurs** : le paramétrage de l'application (fréquence, finalités, période) doit être documenté dans le registre **et** correspondre à la délibération CIL applicable.
6. [ ] **Relecture par un avocat / notaire burkinabè** de l'intégralité du pack avant toute mise en production.

## 8. Journal des versions

| Version | Date       | Changement                                     |
|---------|------------|------------------------------------------------|
| 1.0     | 2026-09-27 | Création du pack : CGU + Confidentialité + Contrats Commerçant/Livreur (textes fondateurs) + 7 documents de conformité en V0.9 brouillon. |