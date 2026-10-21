/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 💳 Lot 4 — Montant minimum de retrait (retraits wallet).
 *
 * Ajoute à `system_settings` (ligne singleton) :
 *  - `minWithdrawalAmountXof` : seuil en dessous duquel un retrait est refusé.
 *    Valeur par défaut : 1000 FCFA.
 *
 * ⚠️ POURQUOI UNE MIGRATION (et pas seulement un défaut d'entité) :
 * `synchronize` est INTERDIT en production (AGENTS.md §3.1) — une colonne
 * absente côté Render ferait planter la lecture des réglages
 * (« column "minWithdrawalAmountXof" of relation "system_settings" does not
 * exist »). Le défaut SQL reprend exactement la valeur de l'entité pour
 * qu'un boot sur base existante et un boot sur base vierge donnent le MÊME
 * comportement (sinon un redémarrage changerait l'éligibilité au retrait).
 *
 * `IF NOT EXISTS` + `DEFAULT` → compatible avec le `synchronize` de dev et
 * rejouable sans erreur.
 */
export class AddMinWithdrawalAmountSettings1739000000000 implements MigrationInterface {
  name = 'AddMinWithdrawalAmountSettings1739000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
        ADD COLUMN IF NOT EXISTS "minWithdrawalAmountXof" integer
        NOT NULL DEFAULT 1000;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "minWithdrawalAmountXof";`,
    );
  }
}