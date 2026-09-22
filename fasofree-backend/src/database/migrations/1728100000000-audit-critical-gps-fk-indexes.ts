import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Correctifs CRITIQUES de l'audit ECC (base de données) :
 *  - #11 GPS float → double precision (users, user_addresses, businesses)
 *  - #12 FK businesses.ownerId → users.id (nullable, orphelins nettoyés d'abord)
 *  - #13 Index sur orders.status
 *  - #14 Index sur order_items.orderId
 *  - #7  Colonne deliveryPinCode varchar(4) → varchar(6) (PIN 6 chiffres)
 *  -     Index sur businesses.ownerId (colonne FK la plus utilisée)
 */
export class AuditCriticalGpsFkIndexes1728100000000 implements MigrationInterface {
  name = 'AuditCriticalGpsFkIndexes1728100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. #11 : GPS float → double precision (précision ~nanomètre).
    //    user_addresses est protégé (table absente sur certaines BD → no-op).
    await queryRunner.query(`
      ALTER TABLE users
      ALTER COLUMN latitude TYPE double precision USING "latitude"::double precision,
      ALTER COLUMN longitude TYPE double precision USING "longitude"::double precision
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE user_addresses
          ALTER COLUMN latitude  TYPE double precision USING "latitude"::double precision,
          ALTER COLUMN longitude TYPE double precision USING "longitude"::double precision;
      EXCEPTION WHEN undefined_table THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE businesses
      ALTER COLUMN latitude TYPE double precision USING "latitude"::double precision,
      ALTER COLUMN longitude TYPE double precision USING "longitude"::double precision
    `);

    // 2. #7 : le PIN de livraison fait 6 chiffres (crypto.randomInt) — varchar(6).
    await queryRunner.query(`
      ALTER TABLE orders
      ALTER COLUMN "deliveryPinCode" TYPE varchar(6)
    `);

    // 3. #12 : nettoyage des orphelins PUIS FK ownerId → users(id)
    //    (la contrainte échouerait si des ownerId pointaient vers des users supprimés).
    await queryRunner.query(`
      UPDATE businesses
      SET "ownerId" = NULL
      WHERE "ownerId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u."id" = businesses."ownerId")
    `);
    await queryRunner.query(`
      ALTER TABLE businesses
      DROP CONSTRAINT IF EXISTS fk_businesses_owner
    `);
    await queryRunner.query(`
      ALTER TABLE businesses
      ADD CONSTRAINT fk_businesses_owner
      FOREIGN KEY ("ownerId") REFERENCES users(id) ON DELETE SET NULL
    `);

    // 4. Index sur la colonne FK ownerId (jointures auth / analytics)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_businesses_owner_id" ON businesses ("ownerId")
    `);

    // 5. #13 : index sur le statut (requêtes de listing/filtrage par statut)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_orders_status" ON orders ("status")
    `);

    // 6. #14 : index sur la FK orderId (jointures items → commandes)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_order_items_order_id" ON order_items ("orderId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_items_order_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_businesses_owner_id"`);
    await queryRunner.query(
      `ALTER TABLE businesses DROP CONSTRAINT IF EXISTS fk_businesses_owner`,
    );
    await queryRunner.query(`
      ALTER TABLE orders
      ALTER COLUMN "deliveryPinCode" TYPE varchar(4)
    `);
    // Type d'origine des colonnes GPS = real (float4), pas float (= float8).
    await queryRunner.query(`
      ALTER TABLE businesses
      ALTER COLUMN latitude TYPE real USING "latitude"::real,
      ALTER COLUMN longitude TYPE real USING "longitude"::real
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE user_addresses
          ALTER COLUMN latitude  TYPE real USING "latitude"::real,
          ALTER COLUMN longitude TYPE real USING "longitude"::real;
      EXCEPTION WHEN undefined_table THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE users
      ALTER COLUMN latitude TYPE real USING "latitude"::real,
      ALTER COLUMN longitude TYPE real USING "longitude"::real
    `);
  }
}