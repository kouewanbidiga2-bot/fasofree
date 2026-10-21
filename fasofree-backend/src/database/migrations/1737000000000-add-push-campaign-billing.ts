/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 💳 Lot 3 — Campagnes push auto-service payantes.
 *
 * Deux volets :
 *
 * 1. `push_campaigns` reçoit la traçabilité de la facturation :
 *    - `ownerUserId`        : compte payeur (BUSINESS_ADMIN ou agence) ;
 *                             NULL = campagne admin (gratuite, historique).
 *    - `audience`           : audience visée (ALL_CLIENTS / OWN_CLIENTS /
 *                             OWN_DRIVERS). NULL = cible par rôle (admin).
 *    - `billedXof`          : total facturé, cumulé sur les exécutions.
 *    - `walletTransactionId`: dernière écriture de portefeuille liée.
 *    - `failureReason`      : motif de suspension (ex. solde insuffisant).
 *
 * 2. `wallet_transactions_reason_enum` reçoit le motif `PUSH_CAMPAIGN_FEE`.
 *
 * ⚠️ POURQUOI CE SECOND POINT EST CRITIQUE : `synchronize` est INTERDIT en
 * production (AGENTS.md §3.1). Le motif `reason` de `wallet_transactions` est
 * une colonne ENUM Postgres : sans ce `ALTER TYPE`, tout débit d'une campagne
 * échouerait en 22P02 (« invalid input value for enum
 * wallet_transactions_reason_enum: "PUSH_CAMPAIGN_FEE" »). C'est exactement le
 * bug rencontré sur `orders_status_enum` (migration 1734000000000) — on
 * réutilise ici le motif éprouvé :
 *  - `ADD VALUE IF NOT EXISTS` → idempotent ;
 *  - bloc `DO … EXCEPTION WHEN undefined_object` → no-op si le type n'existe
 *    pas (base sans enum Postgres) ;
 *  - la nouvelle valeur n'est JAMAIS utilisée dans cette migration
 *    (contrainte PostgreSQL : une valeur ajoutée n'est pas utilisable dans la
 *    même transaction).
 *
 * Toutes les colonnes sont nullables ou pourvues d'un défaut : les campagnes
 * existantes restent des campagnes admin gratuites, strictement inchangées.
 */
export class AddPushCampaignBilling1737000000000 implements MigrationInterface {
  name = 'AddPushCampaignBilling1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sérialise deux instances Render qui booteraient en même temps.
    await queryRunner.query(
      `SELECT pg_advisory_xact_lock(hashtext('push_campaign_billing_1737000000000'))`,
    );

    // ── 1. Motif de transaction : PUSH_CAMPAIGN_FEE ──────────────────
    await queryRunner.query(`DO $$ BEGIN
      ALTER TYPE "wallet_transactions_reason_enum" ADD VALUE IF NOT EXISTS 'PUSH_CAMPAIGN_FEE';
    EXCEPTION WHEN undefined_object THEN NULL; END $$;`);

    // ── 2. Traçabilité de la facturation sur la campagne ─────────────
    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "ownerUserId" character varying(64);
    `);

    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "audience" character varying(40);
    `);

    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "billedXof" integer NOT NULL DEFAULT 0;
    `);

    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "walletTransactionId" character varying(64);
    `);

    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "failureReason" character varying(300);
    `);

    // Un opérateur ne liste QUE ses propres campagnes (`WHERE ownerUserId = …`).
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_push_campaigns_ownerUserId" ON "push_campaigns" ("ownerUserId");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_push_campaigns_ownerUserId";`,
    );
    for (const column of [
      'failureReason',
      'walletTransactionId',
      'billedXof',
      'audience',
      'ownerUserId',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "push_campaigns" DROP COLUMN IF EXISTS "${column}";`,
      );
    }
    // Non destructif : on ne retire JAMAIS une valeur d'un enum
    // (des transactions peuvent déjà l'utiliser), comme toutes les migrations
    // de ce repo.
  }
}
