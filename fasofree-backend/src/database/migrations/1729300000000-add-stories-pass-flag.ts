import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🟦 Drapeau « Pass Stories » (fonctionnalité de collaboration).
 * Suspendu par défaut : la colonne est ajoutée avec default false.
 */
export class AddStoriesPassFlag1729300000000 implements MigrationInterface {
  name = 'AddStoriesPassFlag1729300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
        ADD COLUMN IF NOT EXISTS "storiesPassEnabled" boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "storiesPassEnabled";
    `);
  }
}
