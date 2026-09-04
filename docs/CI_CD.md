# CI / CD — FasoFree

## CI (GitHub Actions)

Le workflow vit dans **`.github/workflows/ci.yml` à la racine du dépôt** (GitHub ne lit que la racine). L'ancien `fasofree-backend/.github/workflows/ci.yml` était **inactif** et a été supprimé.

### Déclencheurs
- `push` sur `main` / `master`
- `pull_request` vers `main` / `master`

### Jobs
| Job | Contenu | Bloquant ? |
|---|---|---|
| `backend` | `npm ci`, `check:secrets`, `tsc --noEmit`, `build`, `test`, `npm audit` | ✅ Oui |
| `backend` → lint | `eslint` | ⚠️ Non (dette pré-existante ~772 erreurs `prettier/prettier` : affiché pour info, ne bloque pas) |
| `frontend` | Build Vite de `fasofree-frontend` et `fasofree-frontend-client` | ✅ Oui |

Le pipeline arrête **automatiquement** les runs concurrents sur la même branche (`concurrency.cancel-in-progress`).

### Secrets CI
- `check:secrets` détecte tout secret codé en dur commis (`tools/check-secrets.js`). S'il échoue, la build est bloquée.

## CD (Render)

Render redéploie **automatiquement sur `push` à `main`**. Pour cette raison :
- **Ne pas** pousser de branches de feature vers `main` pour tester : un push = déploiement prod.
- Toute fusion dans `main` doit être validée localement (`tsc`, `build`, `test`) et **au minimum** passer la CI.

Les 3 services sont pilotés par `render.yaml` :
- `fasofree-api` (NestJS Docker) — avec **migrations désactivées sur `synchronize`**, activées sur `DB_MIGRATIONS_RUN`.
- `fasofree-admin` (dashboard Vite)
- `fasofree-client` (app Vite)

## Comment vérifier une livraison
1. Local : `cd fasofree-backend && npm run check` (tsc + lint + build + test).
2. CI : le badge sur `main` doit être vert.
3. Après push : Render redéploie ; vérifier `/api/v1/health/ready` (readiness, base de données).
