import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Ajout des champs fulfillment pour les commandes
 *
 * Champs ajoutés:
 * - fulfillmentType: ENUM (DELIVERY, PICKUP, DINE_IN)
 * - fulfillmentDetails: JSONB (optionnel)
 */
export class AddOrderFulfillment1724100000000 implements MigrationInterface {
  name = 'AddOrderFulfillment1724100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Créer l'enum pour les types de fulfillment
    await queryRunner.query(`
      CREATE TYPE "fulfillment_type_enum" AS ENUM (
        'DELIVERY',
        'PICKUP',
        'DINE_IN'
      );
    `);

    // Ajouter les nouveaux champs à la table orders
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN "fulfillmentType" "fulfillment_type_enum" NOT NULL DEFAULT 'DELIVERY',
      ADD COLUMN "fulfillmentDetails" JSONB;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Supprimer les nouveaux champs
    await queryRunner.query(`
      ALTER TABLE "orders"
      DROP COLUMN "fulfillmentDetails",
      DROP COLUMN "fulfillmentType";
    `);

    // Supprimer l'enum
    await queryRunner.query(`DROP TYPE "fulfillment_type_enum";`);
  }
}
