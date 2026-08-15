import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Marques (Brands) & multi-agences
 *
 * 1. Table "brands" (marques multi-agences)
 * 2. Colonne "brandId" sur "businesses" (agences rattachées à une marque)
 *
 * NB: Tout en "IF NOT EXISTS" pour rester compatible avec le synchronize TypeORM (dev).
 */
export class AddBrands1724500000001 implements MigrationInterface {
  name = 'AddBrands1724500000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "brands" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(150) NOT NULL,
        "description" character varying(255),
        "logoUrl" character varying(500),
        "ownerId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_brands" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      ALTER TABLE "businesses"
      ADD COLUMN IF NOT EXISTS "brandId" uuid;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_businesses_brandId"
      ON "businesses" ("brandId");
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_businesses_brand'
        ) THEN
          ALTER TABLE "businesses"
          ADD CONSTRAINT "FK_businesses_brand"
          FOREIGN KEY ("brandId") REFERENCES "brands"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "businesses" DROP CONSTRAINT IF EXISTS "FK_businesses_brand";
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_businesses_brandId";`);
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "brandId";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "brands";`);
  }
}
