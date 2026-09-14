import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWalletTransactionsTable1726100000001 implements MigrationInterface {
  name = 'CreateWalletTransactionsTable1726100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE wallet_transactions_type_enum AS ENUM ('CREDIT', 'DEBIT', 'DEPOSIT');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE wallet_transactions_status_enum AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE wallet_transactions_reason_enum AS ENUM (
          'ORDER_PAYMENT', 'DELIVERY_FEE', 'COMMISSION', 'WITHDRAWAL',
          'TOPUP', 'REFUND', 'REFERRAL_REWARD', 'PAYOUT',
          'DAILY_PASS_FEE', 'SERVICE_FEE', 'SUBSCRIPTION_FEE'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wallet_transactions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "walletId" UUID NOT NULL,
        "branchId" UUID,
        "type" wallet_transactions_type_enum NOT NULL,
        "status" wallet_transactions_status_enum DEFAULT 'COMPLETED' NOT NULL,
        "reason" wallet_transactions_reason_enum NOT NULL,
        "amount" DECIMAL(12,2) NOT NULL,
        "balanceAfter" DECIMAL(12,2) NOT NULL,
        "reference" VARCHAR,
        "description" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "FK_wallet_transactions_wallet" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wallet_transactions_walletId" ON "wallet_transactions" ("walletId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wallet_transactions_branchId" ON "wallet_transactions" ("branchId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wallet_transactions_reference" ON "wallet_transactions" ("reference");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_transactions";`);
  }
}
