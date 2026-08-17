import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddP2PDeliveryFields1724400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add P2P delivery fields to orders table
    await queryRunner.query(`
      ALTER TABLE "orders" 
      ADD COLUMN IF NOT EXISTS "pickupLocation" jsonb,
      ADD COLUMN IF NOT EXISTS "dropoffLocation" jsonb,
      ADD COLUMN IF NOT EXISTS "packageDetails" jsonb
    `);

    // Update OrderType enum to include MERCHANT and P2P_DELIVERY
    await queryRunner.query(`
      ALTER TABLE "orders" 
      ALTER COLUMN "orderType" TYPE VARCHAR(50)
    `);

    // Set default value for existing rows to maintain compatibility
    await queryRunner.query(`
      UPDATE "orders" 
      SET "orderType" = 'MERCHANT' 
      WHERE "orderType" IS NULL OR "orderType" = 'DELIVERY'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove P2P delivery fields
    await queryRunner.query(`
      ALTER TABLE "orders" 
      DROP COLUMN IF EXISTS "pickupLocation",
      DROP COLUMN IF EXISTS "dropoffLocation",
      DROP COLUMN IF EXISTS "packageDetails"
    `);

    // Revert orderType changes
    await queryRunner.query(`
      UPDATE "orders" 
      SET "orderType" = 'DELIVERY' 
      WHERE "orderType" = 'MERCHANT'
    `);
  }
}
