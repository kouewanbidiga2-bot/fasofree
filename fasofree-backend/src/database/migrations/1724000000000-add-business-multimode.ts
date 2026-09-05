import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Ajout des champs multi-modes et multi-secteurs pour les commerces
 *
 * Champs ajoutés:
 * - category: ENUM (RESTAURANT, SUPERMARKET, PHARMACY, RETAIL, BAKERY, SERVICES)
 * - enableDelivery: BOOLEAN (default: true)
 * - enablePickup: BOOLEAN (default: true)
 * - enableDineIn: BOOLEAN (default: false)
 * - hasOwnDrivers: BOOLEAN (default: false)
 */
export class AddBusinessMultimode1724000000000 implements MigrationInterface {
  name = 'AddBusinessMultimode1724000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Creer l'enum si elle n'existe pas deja
    const enumExists = await queryRunner.query(`
      SELECT 1 FROM pg_type WHERE typname = 'business_category_enum'
    `);
    if (enumExists.length === 0) {
      await queryRunner.query(`
        CREATE TYPE "business_category_enum" AS ENUM (
          'RESTAURANT',
          'SUPERMARKET',
          'PHARMACY',
          'RETAIL',
          'BAKERY',
          'SERVICES'
        );
      `);
    }

    // Verifier si la colonne category existe deja
    const colExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'businesses' AND column_name = 'category'
    `);
    if (colExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "businesses"
        ADD COLUMN "category" "business_category_enum" NOT NULL DEFAULT 'RESTAURANT',
        ADD COLUMN "enableDelivery" BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN "enablePickup" BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN "enableDineIn" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN "hasOwnDrivers" BOOLEAN NOT NULL DEFAULT false;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const colExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'businesses' AND column_name = 'category'
    `);
    if (colExists.length > 0) {
      await queryRunner.query(`
        ALTER TABLE "businesses"
        DROP COLUMN "hasOwnDrivers",
        DROP COLUMN "enableDineIn",
        DROP COLUMN "enablePickup",
        DROP COLUMN "enableDelivery",
        DROP COLUMN "category";
      `);
    }

    const enumExists = await queryRunner.query(`
      SELECT 1 FROM pg_type WHERE typname = 'business_category_enum'
    `);
    if (enumExists.length > 0) {
      await queryRunner.query(`DROP TYPE "business_category_enum";`);
    }
  }
}
