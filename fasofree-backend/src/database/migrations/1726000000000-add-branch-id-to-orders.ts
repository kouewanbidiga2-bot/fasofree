import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBranchIdToOrders1726000000000 implements MigrationInterface {
  name = 'AddBranchIdToOrders1726000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ajouter branchId si elle n'existe pas déjà
    const columnExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'branchId'
      )
    `);

    if (!columnExists[0].exists) {
      await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN "branchId" uuid
      `);
    }

    // Index pour les requêtes par agence (créé même si la colonne existait déjà)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_branchId"
      ON "orders" ("branchId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF NOT EXISTS "IDX_orders_branchId"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "branchId"`);
  }
}
