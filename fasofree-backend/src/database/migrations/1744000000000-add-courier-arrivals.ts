import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourierArrivals1744000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "pickupArrival" jsonb,
      ADD COLUMN IF NOT EXISTS "dropoffArrival" jsonb`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "pickupArrival",
      DROP COLUMN IF EXISTS "dropoffArrival"`);
  }
}
