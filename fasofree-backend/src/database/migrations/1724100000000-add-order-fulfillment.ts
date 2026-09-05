import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderFulfillment1724100000000 implements MigrationInterface {
  name = 'AddOrderFulfillment1724100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_type_enum') THEN
          CREATE TYPE "fulfillment_type_enum" AS ENUM ('DELIVERY','PICKUP','DINE_IN');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "fulfillmentType" "fulfillment_type_enum" NOT NULL DEFAULT 'DELIVERY',
      ADD COLUMN IF NOT EXISTS "fulfillmentDetails" JSONB;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "fulfillmentDetails", DROP COLUMN IF EXISTS "fulfillmentType";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "fulfillment_type_enum";`);
  }
}
