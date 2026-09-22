import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajoute les colonnes de frais de payout à system_settings.
 *
 * Contexte : ces colonnes (isPayoutFeeActive, payoutFeePercentage,
 * payoutFreeThreshold) existaient historiquement en base via synchronize:true
 * et n'ont JAMAIS été ajoutées par une migration. Sur une base vierge migrée
 * uniquement, elles manquent → le seed de SettingsService (onModuleInit)
 * échoue avec "column ... of relation "system_settings" does not exist"
 * (SQLSTATE 42703).
 *
 * Placement : 1728200000000, APRÈS la fin de la chaîne (1728100000000).
 * Audit statique (toutes entités vs toutes migrations) : aucun autre écart.
 */
export class AddPayoutFeeSettingsColumns1728200000000 implements MigrationInterface {
  name = 'AddPayoutFeeSettingsColumns1728200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
        ADD COLUMN IF NOT EXISTS "isPayoutFeeActive" boolean NOT NULL DEFAULT false;
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
        ADD COLUMN IF NOT EXISTS "payoutFeePercentage" decimal(5,2) NOT NULL DEFAULT 1.5;
    `);
    await queryRunner.query(`
      ALTER TABLE "system_settings"
        ADD COLUMN IF NOT EXISTS "payoutFreeThreshold" integer NOT NULL DEFAULT 20000;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "isPayoutFeeActive";`);
    await queryRunner.query(`ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "payoutFeePercentage";`);
    await queryRunner.query(`ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "payoutFreeThreshold";`);
  }
}