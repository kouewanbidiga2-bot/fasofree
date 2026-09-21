import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalletBalancesAndPayoutFields1726400000000 implements MigrationInterface {
  name = 'AddWalletBalancesAndPayoutFields1726400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Wallets : ajouter availableBalance et heldBalance
    await queryRunner.query(`
      ALTER TABLE "wallets"
      ADD COLUMN "availableBalance" DECIMAL(12,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "wallets"
      ADD COLUMN "heldBalance" DECIMAL(12,2) NOT NULL DEFAULT 0
    `);

    // 2. Backfill : availableBalance = balance, heldBalance = 0 (tout est disponible)
    await queryRunner.query(`
      UPDATE "wallets"
      SET "availableBalance" = "balance", "heldBalance" = 0
    `);

    // 3. Payout_requests : ajouter les champs manquants
    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      ADD COLUMN "walletId" UUID
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      ADD COLUMN "branchId" UUID
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      ADD COLUMN "fees" DECIMAL(12,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      ADD COLUMN "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      ADD COLUMN "provider" VARCHAR
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      ADD COLUMN "providerReference" VARCHAR
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      ADD COLUMN "failureReason" VARCHAR
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      ADD COLUMN "completedAt" TIMESTAMPTZ
    `);

    // Index pour les requêtes fréquentes
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
