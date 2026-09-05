import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixOrderItemProductIdType1724700000000 implements MigrationInterface {
  name = 'FixOrderItemProductIdType1724700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE order_items ALTER COLUMN "productId" TYPE varchar;
      EXCEPTION WHEN undefined_column THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE order_items ALTER COLUMN "productId" TYPE uuid USING "productId"::uuid
    `);
  }
}
