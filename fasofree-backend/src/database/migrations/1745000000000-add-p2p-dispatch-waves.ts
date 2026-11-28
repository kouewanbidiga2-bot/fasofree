import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddP2pDispatchWaves1745000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "p2pDispatchWave" integer NOT NULL DEFAULT 0;
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "nextP2pDispatchAt" timestamptz;
      CREATE INDEX IF NOT EXISTS "IDX_orders_due_p2p_dispatch"
        ON "orders" ("nextP2pDispatchAt") WHERE "driverId" IS NULL AND "nextP2pDispatchAt" IS NOT NULL;
      UPDATE "orders"
        SET "nextP2pDispatchAt" = NOW()
        WHERE "orderType" = 'P2P_DELIVERY' AND "fulfillmentType" = 'DELIVERY'
          AND "status" IN ('PAID', 'READY_FOR_PICKUP') AND "paymentTransactionRef" IS NOT NULL
          AND "driverId" IS NULL AND "deliveryProviderId" IS NULL
          AND "createdAt" >= NOW() - INTERVAL '24 hours' AND "p2pDispatchWave" = 0
          AND "nextP2pDispatchAt" IS NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_orders_due_p2p_dispatch";
      ALTER TABLE "orders" DROP COLUMN IF EXISTS "nextP2pDispatchAt";
      ALTER TABLE "orders" DROP COLUMN IF EXISTS "p2pDispatchWave";
    `);
  }
}
