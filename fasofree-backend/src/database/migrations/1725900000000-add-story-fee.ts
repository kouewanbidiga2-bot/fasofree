/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 💰 Stories payantes :
 * - Ajoute le motif de débit STORY_FEE (50 FCFA par story à l'unité).
 * L'abonnement mensuel (Pass Stories 5 000 FCFA) réutilise le motif
 * SUBSCRIPTION_FEE déjà existant — aucun autre changement de schéma requis.
 */
export class AddStoryFee1725900000000 implements MigrationInterface {
  name = 'AddStoryFee1725900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ⚠️ Sur base vierge, le type "wallet_transactions_reason_enum" n'existe
    // pas encore (créé par 1726100000001, postérieure) : un try/catch JS ne
    // suffit pas car l'erreur avorte la transaction TypeORM. Le garde
    // EXCEPTION undefined_object rend ce bloc no-op sans perte :
    // 1726100000001 crée déjà l'enum avec la valeur STORY_FEE.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'STORY_FEE') THEN
          ALTER TYPE "wallet_transactions_reason_enum" ADD VALUE 'STORY_FEE';
        END IF;
      EXCEPTION WHEN undefined_object THEN NULL;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Non destructif : on n'ajoute jamais de valeur dans un enum en down().
  }
}
