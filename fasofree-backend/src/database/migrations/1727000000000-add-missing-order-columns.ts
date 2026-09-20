import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Ajout des colonnes manquantes dans orders.
 *
 * Ces colonnes existent dans l'entité TypeORM mais n'ont jamais été migrées,
 * causant des erreurs 500 lors des commandes DELIVERY (INSERT avec colonne inexistante).
 *
 * Colonnes ajoutées:
 * - deliveryLocation: JSONB (GPS de livraison client)
 * - paymentMethod: VARCHAR (orange_money, moov_money, wave, cash)
 * - landmark: VARCHAR (repère local pour le livreur)
 */
export class AddMissingOrderColumns1727000000000 implements MigrationInterface {
  name = 'AddMissingOrderColumns1727000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "deliveryLocation" JSONB,
      ADD COLUMN IF NOT EXISTS "paymentMethod" VARCHAR,
      ADD COLUMN IF NOT EXISTS "landmark" VARCHAR(255);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "deliveryLocation",
      DROP COLUMN IF EXISTS "paymentMethod",
      DROP COLUMN IF EXISTS "landmark";
    `);
  }
}
