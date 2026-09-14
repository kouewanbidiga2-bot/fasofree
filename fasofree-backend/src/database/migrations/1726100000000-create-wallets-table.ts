import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWalletsTable1726100000000 implements MigrationInterface {
  name = 'CreateWalletsTable1726100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Créer la table wallets si elle n'existe pas (idempotent)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE wallets_userrole_enum AS ENUM ('DRIVER', 'COURIER', 'MERCHANT', 'CUSTOMER');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        userId VARCHAR NOT NULL,
        userRole wallets_userrole_enum NOT NULL,
        branchId UUID,
        balance DECIMAL(12,2) DEFAULT 0 NOT NULL,
        currency VARCHAR(3) DEFAULT 'XOF' NOT NULL,
        isActive BOOLEAN DEFAULT true NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE (userId, userRole, branchId)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wallets_user_branch" ON "wallets" ("userId", "userRole", "branchId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wallets";`);
  }
}
