import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Ajout des champs de tracking dispatch et QR Code pour les commandes
 *
 * Champs ajoutés:
 * - dispatchCandidates: JSONB (tracking des candidats notifiés)
 * - dispatchedAt: TIMESTAMP (date de dispatch)
 * - qrCode: VARCHAR(32) UNIQUE (QR Code pour PICKUP/DINE_IN)
 */
export class AddOrderDispatchTracking1724200000000 implements MigrationInterface {
  name = 'AddOrderDispatchTracking1724200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ajouter les nouveaux champs à la table orders
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN "dispatchCandidates" JSONB,
      ADD COLUMN "dispatchedAt" TIMESTAMP,
      ADD COLUMN "qrCode" VARCHAR(32) UNIQUE;
    `);

    // Créer un index sur qrCode pour les recherches rapides
    await queryRunner.query(`
      CREATE INDEX "idx_orders_qr_code" ON "orders"("qrCode");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Supprimer l'index
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_qr_code";`);

    // Supprimer les nouveaux champs
    await queryRunner.query(`
      ALTER TABLE "orders"
      DROP COLUMN "qrCode",
      DROP COLUMN "dispatchedAt",
      DROP COLUMN "dispatchCandidates";
    `);
  }
}
