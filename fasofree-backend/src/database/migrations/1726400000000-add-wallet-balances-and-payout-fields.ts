import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalletBalancesAndPayoutFields1726400000000 implements MigrationInterface {
  name = 'AddWalletBalancesAndPayoutFields1726400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guard : tables créées plus tard sur une base neuve.
    const wallets = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'wallets'`,
    );
    const payoutRequests = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_requests'`,
    );

    // 1. Wallets : ajouter availableBalance et heldBalance (idempotent)
    if (wallets.length > 0) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "wallets" ADD COLUMN "availableBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "wallets" ADD COLUMN "heldBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);

      // 2. Backfill : availableBalance = balance, heldBalance = 0 (tout est disponible)
      await queryRunner.query(`
        UPDATE "wallets"
        SET "availableBalance" = "balance", "heldBalance" = 0
        WHERE "availableBalance" = 0 AND "heldBalance" = 0 AND "balance" <> 0
      `);
    }

    // 3. Payout_requests : ajouter les champs manquants (idempotent)
    if (payoutRequests.length > 0) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "payout_requests" ADD COLUMN "walletId" UUID;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "payout_requests" ADD COLUMN "branchId" UUID;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "payout_requests" ADD COLUMN "fees" DECIMAL(12,2) NOT NULL DEFAULT 0;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "payout_requests" ADD COLUMN "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "payout_requests" ADD COLUMN "provider" VARCHAR;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "payout_requests" ADD COLUMN "providerReference" VARCHAR;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "payout_requests" ADD COLUMN "failureReason" VARCHAR;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "payout_requests" ADD COLUMN "completedAt" TIMESTAMPTZ;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
    }

    // Index pour les requêtes fréquentes
    if (payoutRequests.length > 0) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_payout_requests_status" ON "payout_requests" ("status")
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_payout_requests_walletId" ON "payout_requests" ("walletId")
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_payout_requests_branchId" ON "payout_requests" ("branchId")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "completedAt"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "failureReason"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "providerReference"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "provider"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "netAmount"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "fees"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "branchId"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "walletId"`);
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "heldBalance"`);
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "availableBalance"`);
  }
}
