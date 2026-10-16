# FasoFree — AGENTS.md

Guidance operative pour les agents (OpenCode, Claude Code, Codex…).
Ce fichier couvre **l'outillage** et **les pièges vérifiés du dépôt**.
Il ne remplace **pas** `RAPPORT_TECHNIQUE.md` (architecture détaillée).

> ⚠️ `PROJECT_BIBLE.md` est **DEPRECATED** (providers de paiement obsolètes :
> seul **GeniusPay** est actif). Ne pas s'en servir comme référence.

---

## 1. Stack (vérifiée dans les `package.json`)

| Composant | Stack |
|---|---|
| `fasofree-backend` | **NestJS** + TypeORM + PostgreSQL + Socket.IO + Redis + Jest |
| `fasofree-frontend` | **React** + Vite + Tailwind + React Router v7 + Zustand (back-office) |
| `fasofree-frontend-client` | React + Vite (application client) |
| Déploiement | **Render** (backend, service **Docker**) + **Vercel** (frontends) |
| Qualité | ESLint + Prettier + **husky** `pre-commit` + lint-staged (`*.ts`) |

Langages présents : **TypeScript (356)**, **JSX (97)**, **JS (64)**.
Absents : Python, Go, Rust, Java, Kotlin, Ruby, PHP, C++, Flutter, Solidity.

---

## 2. Vérification obligatoire avant tout commit

Toujours **depuis le dossier du package** (lancer depuis la racine échoue) :

```bash
cd fasofree-backend
npx tsc --noEmit      # 0 erreur attendue
npm test              # 156 tests attendus
npm run build

cd ../fasofree-frontend
npx vite build
```

- `npm run check` enchaîne typecheck + lint + build + test (le plus complet).
- Frontend et backend sont versionnés ensemble : **les deux** builds doivent passer.

---

## 3. Pièges vérifiés (ne pas les réapprendre)

### 3.1 `synchronize` est INTERDIT en production
`src/config/database.config.ts` : `synchronize = !isProd`. En prod, `migrationsRun` prend le relais.
→ **Toute nouvelle colonne d'entité exige une migration** dans
`src/database/migrations/`, écrite en `IF NOT EXISTS` (compatible avec le `synchronize` de dev).
Les migrations s'exécutent au démarrage : `tsc` vert ne suffit pas.

### 3.2 Enum PostgreSQL : caster avant `LOWER()`
`role` est un enum. `LOWER(u.role)` → `function lower(users_role_enum) does not exist` (endpoint 500, compteurs à 0).
→ Toujours `LOWER(CAST(u.role AS text))`.

### 3.3 Le push FCM est désactivé au lancement
`VITE_PUSH_ENABLED` est **absent** de `.env` / `.env.local` → **désactivé volontairement**.
Ne pas l'activer sans application mobile. Les notifications passent par
`NotificationsService.sendNotification()` (EMAIL → SMS → WhatsApp → PUSH, avec repli).
Conséquence : **aucun utilisateur n'a de `fcmToken`**. Toute logique qui filtre sur
`fcmToken IS NOT NULL` sélectionne zéro destinataire — bug déjà rencontré sur les campagnes.

### 3.4 Les rôles sont un contrat, pas un détail
Les endpoints sont verrouillés par `@Roles` + `RolesGuard`, et `BanRequestService.review()`
revérifie le rôle **en interne**. Avant d'ajouter un appel frontend, vérifier les rôles du
endpoint : beaucoup sont `SUPER_ADMIN` seuls et retournent 403 en silence
(`catch` → état vide, sans message visible).

### 3.5 Ne pas faire confiance aux diagnostics antérieurs
Replier sur l'état réel du fichier avant d'agir (plusieurs diagnostics de sessions
précédentes se sont révélés faux sur des fichiers lus partiellement).

---

## 4. Conventions de code

- Entités TypeORM, uuid, `@CreateDateColumn` / `@UpdateDateColumn`.
- DTOs `class-validator` ; les contraintes de longueur **doivent** refléter les colonnes
  (sinon erreur Postgres 500 au lieu d'un 400 explicite).
- Comments **en français**, expliquant le *pourquoi* (surtout les garde-fous non évidents).
- Ne jamais supprimer un endpoint ou un export : ajouter est sûr, retirer casse.

---

## 5. Mémoire projet

`.ecc/memory/project/` contient les mémoires ECC (facts, handoffs, lessons, decisions).

Les deux scopes sont actifs : `project` (mémoires de FasoFree dans `.ecc/memory/project/`)
et `user` (mémoires transprojets, activé via `ECC_MEMORY_ALLOW_USER_SCOPE=1` dans
`~/.config/opencode/opencode.json`).

> ⚠️ Le scope `user` est **partagé entre tous les projets** de la machine.
> Ne pas y déposer de contexte spécifique à FasoFree : il fuiterait dans les
> autres dépôts. Utiliser `project` pour ce qui est propre à ce repo.

---

## 6. Routage ECC (67 skills installés — tous chargés en contexte)

### DAILY — utiliser sans hésiter
`verification-loop` · `click-path-audit` · `gateguard` · `error-handling` ·
`tdd-workflow` · `ai-regression-testing` · `git-workflow` · `security-review` ·
`production-audit` · `context-budget` · `strategic-compact` ·
`intent-driven-development` · `unified-memory` · `ecc-guide` · `agent-sort`

Commands : `verify` · `code-review` · `build-fix` · `plan` · `feature-dev` ·
`refactor-clean` · `test-coverage` · `quality-gate` · `harness-audit` · `security-scan`

### LIBRARY — n'invoquer qu'explicitement
Hors stack (**17 skills**, ne jamais proposer spontanément) :
`django-security` · `laravel-security` · `perl-security` · `quarkus-security` ·
`springboot-security` · `defi-amm-security` · `evm-token-decimals` · `nodejs-keccak256` ·
`llm-trading-agent-security` · `healthcare-*` (4) · `hipaa-compliance`

Commandes hors stack (**22**) : `cpp-*` · `go-*` · `kotlin-*` · `rust-*` ·
`flutter-*` · `gradle-build` · `gan-*` · `fastapi-review` · `python-review` ·
`vue-review` · `pm2` (le repo tourne en **Docker**, pas en pm2)

Méta-outillage ponctuel : `skill-scout` · `skill-stocktake` · `skill-comply` ·
`skill-create` · `rules-distill` · `hookify-rules` · `config-gc` · `codehealth-mcp` ·
`plankton-code-quality` · `repo-scan` · `continuous-learning` (**v1 dépréciée** → utiliser `continuous-learning-v2`)