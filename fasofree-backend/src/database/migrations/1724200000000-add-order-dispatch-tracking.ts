import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderDispatchTracking1724200000000 implements MigrationInterface {
  name = 'AddOrderDispatchTracking1724200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "dispatchCandidates" JSONB,
      ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "qrCode" VARCHAR(32);
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_qr_code') THEN
          CREATE UNIQUE INDEX "idx_orders_qr_code" ON "orders"("qrCode");
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_qr_code";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "qrCode", DROP COLUMN IF EXISTS "dispatchedAt", DROP COLUMN IF EXISTS "dispatchCandidates";`);
  }
}
