# Reprise après incident — FasoFree

## Objectifs (RPO / RTO)
- **RPO cible** : quelques minutes (sauvegarde PostgreSQL continue — Neon a des **point-in-time recovery (PITR)**).
- **RTO cible** : < 15 min (redémarrage du service Render + rejeu des migrations).

## Cas 1 — Crash de l'API (process)
Le service Render redémarre automatiquement. Rien à faire si `/api/v1/health/ready` repasse en vert.
- Le **cron d'escrow** (`releaseHeldPayouts`) est **restart-safe** : il re-scanne les commandes dues ; un payout déjà `SUCCESS` n'est pas re-exécuté (idempotent).
- Les jobs (`@nestjs/schedule`) sont en base/cron, pas en `setTimeout` : un redémarrage ne perd pas d'états.

## Cas 2 — Perte de connectivité DB (Neon)
- Vérifier `DATABASE_URL` et le statut Neon. `/api/v1/health/ready` passe en `503` → Render arrête de router le trafic.
- Vérifier `ssl: { rejectUnauthorized: false }` (caveat du pooler Neon).

## Cas 3 — Erreur / corruption du schéma
- **Ne jamais** activer `synchronize` pour réparer. Rejouer les migrations additives :
  ```bash
  npx typeorm migration:run
  ```
- Contrôle de version : chaque schéma en prod doit correspondre à une migration committée.

## Cas 4 — Données / restauration (PITR)
1. Depuis la console Neon, sélectionner un **point de restauration** (PITR) antérieur à l'incident.
2. Restaurer vers une nouvelle base, récupérer la nouvelle `DATABASE_URL`.
3. Mettre à jour `DATABASE_URL` dans Render, redémarrer.
4. **Paiements / escrow** : le système est idempotent — un escrow déjà libéré ou un payout déjà `SUCCESS` ne seront **pas** re-payés.

## Cas 5 — Payout "PROCESSING" bloqué (état inconnu)
Par conception, un état `PROCESSING` n'est jamais ré-exécuté (risque de double paiement). Procédure :
1. Identifier : `SELECT * FROM merchant_payouts WHERE status='PROCESSING';`
2. **Réconcilier** avec le provider (le virement a-t-il abouti ?).
   - Si abouti → passer le payout en `SUCCESS` et `orders.payoutReleased=true`.
   - Si aucun virement envoyé → repasser le payout en `FAILED` ; le cron retentera automatiquement.

## Cas 6 — Faux paiement suspecté / double crédit
- Vérifier les logs webhooks (`[Webhook … REJETÉ]`, `[Amount mismatch]`).
- Contrôle d'intégrité : un seul `merchant_payouts` par `orderId` (index UNIQUE) ; un seul crédit par `(walletId, reference, reason)`.
- Si un double crédit est détecté, corriger le solde manuellement en s'appuyant sur le ledger `WalletTransaction`.

## Checklist de redéploiement
1. `JWT_SECRET`, `DATABASE_URL` présents (fail-fast sinon).
2. Migrations à jour (`DB_MIGRATIONS_RUN=true`).
3. Secrets webhooks / WhatsApp présents.
4. `/api/v1/health/ready` en vert.
5. Test d'un paiement de bout en bout (sandbox) + libération d'escrow.
