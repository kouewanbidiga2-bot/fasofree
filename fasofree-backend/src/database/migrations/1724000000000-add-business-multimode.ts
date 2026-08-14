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
    // Créer l'enum pour les catégories de commerces
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

    // Ajouter les nouveaux champs à la table businesses
    await queryRunner.query(`
      ALTER TABLE "businesses"
      ADD COLUMN "category" "business_category_enum" NOT NULL DEFAULT 'RESTAURANT',
      ADD COLUMN "enableDelivery" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN "enablePickup" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN "enableDineIn" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN "hasOwnDrivers" BOOLEAN NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Supprimer les nouveaux champs
    await queryRunner.query(`
      ALTER TABLE "businesses"
      DROP COLUMN "hasOwnDrivers",
      DROP COLUMN "enableDineIn",
      DROP COLUMN "enablePickup",
      DROP COLUMN "enableDelivery",
      DROP COLUMN "category";
    `);

    // Supprimer l'enum
    await queryRunner.query(`DROP TYPE "business_category_enum";`);
  }
}
