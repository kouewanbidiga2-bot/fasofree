/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 💳 Lot 3.1 — Tarifs des campagnes push pilotés par le Super Admin.
 *
 * Ajoute à `system_settings` (ligne singleton) :
 *  - `pushCampaignPricing` : grille JSON { audience: prixFCFA } par ENVOI.
 *    Valeurs par défaut : `{ "OWN_CLIENTS": 100, "OWN_DRIVERS": 100,
 *    "ALL_CLIENTS": 2500 }`.
 *
 * ⚠️ POURQUOI UNE MIGRATION (et pas seulement un défaut d'entité) :
 * `synchronize` est INTERDIT en production (AGENTS.md §3.1) — une colonne
 * absente côté Render ferait planter la lecture des réglages
 * (« column "pushCampaignPricing" of relation "system_settings" does not
 * exist »). Le défaut SQL reprend exactement les valeurs de l'entité pour
 * qu'un boot sur base existante et un boot sur base vierge donnent le MÊME
 * tarif (sinon un redémarrage changerait la facturation, ce qui est inacceptable
 * pour un réglage d'argent).
 *
 * `IF NOT EXISTS` + `DEFAULT` → compatible avec le `synchronize` de dev et
 * rejouable sans erreur.
 */
export class AddPushCampaignPricingSettings1738000000000 implements MigrationInterface {
  name = 'AddPushCampaignPricingSettings1738000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
        ADD COLUMN IF NOT EXISTS "pushCampaignPricing" jsonb
        NOT NULL DEFAULT '{ "OWN_CLIENTS": 100, "OWN_DRIVERS": 100, "ALL_CLIENTS": 2500 }'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "pushCampaignPricing";`,
    );
  }
}
