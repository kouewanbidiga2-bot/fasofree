import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderTrackingReference1742000000000 implements MigrationInterface {
  name = 'AddOrderTrackingReference1742000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "trackingReference" varchar(20);
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_orders_trackingReference"
        ON "orders" ("trackingReference");
      UPDATE "orders"
        SET "trackingReference" = UPPER(LEFT(REPLACE(gen_random_uuid()::text, '-', ''), 20))
        WHERE "orderType" = 'P2P_DELIVERY' AND "trackingReference" IS NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_orders_trackingReference";
      ALTER TABLE "orders" DROP COLUMN IF EXISTS "trackingReference";
    `);
  }
}
