import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixOrderItemProductIdType1724700000000 implements MigrationInterface {
  name = 'FixOrderItemProductIdType1724700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guard : order_items peut manquer (base où la table n'existe pas encore).
    const tbl = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items'
    `);
    if (tbl.length === 0) return;

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
