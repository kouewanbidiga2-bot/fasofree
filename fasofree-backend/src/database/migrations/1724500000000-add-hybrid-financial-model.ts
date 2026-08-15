import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Modèle financier hybride FasoFree
 *
 * 1. Ventilation financière détaillée sur orders :
 *    - itemsTotal, serviceFee, merchantCommissionAmount, driverCommissionAmount
 * 2. Abonnements (VIP client 1500F/mois, Boost Pro marchand 5000F/mois)
 * 3. Nouvelles raisons de transaction wallet : DAILY_PASS_FEE, SERVICE_FEE
 *
 * NB: Tout en "IF NOT EXISTS" pour rester compatible avec le synchronize TypeORM (dev).
 */
export class AddHybridFinancialModel1724500000000 implements MigrationInterface {
  name = 'AddHybridFinancialModel1724500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Ventilation financière détaillée des commandes
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "itemsTotal" numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "serviceFee" numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "merchantCommissionAmount" numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "driverCommissionAmount" numeric(10,2) NOT NULL DEFAULT 0;
    `);

    // 2. Enum types des abonnements
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscriptions_subjectType_enum') THEN
          CREATE TYPE "subscriptions_subjectType_enum" AS ENUM ('CUSTOMER', 'MERCHANT');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscriptions_plan_enum') THEN
          CREATE TYPE "subscriptions_plan_enum" AS ENUM ('VIP', 'BOOST_PRO');
        END IF;
      END
      $$;
    `);

    // 3. Table subscriptions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "subjectType" "subscriptions_subjectType_enum" NOT NULL,
        "subjectId" character varying NOT NULL,
        "plan" "subscriptions_plan_enum" NOT NULL,
        "startDate" TIMESTAMP NOT NULL,
        "endDate" TIMESTAMP,
        "isActive" boolean NOT NULL DEFAULT true,
        "autoRenew" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_subscriptions_subject"
      ON "subscriptions" ("subjectType", "subjectId");
    `);

    // 4. Nouvelles raisons de transaction (Pass Journée & Frais de Service)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DAILY_PASS_FEE') THEN
          ALTER TYPE "wallet_transactions_reason_enum" ADD VALUE 'DAILY_PASS_FEE';
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SERVICE_FEE') THEN
          ALTER TYPE "wallet_transactions_reason_enum" ADD VALUE 'SERVICE_FEE';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_subscriptions_subject";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscriptions_plan_enum";`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "subscriptions_subjectType_enum";`,
    );
    await queryRunner.query(`
      ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "driverCommissionAmount",
      DROP COLUMN IF EXISTS "merchantCommissionAmount",
      DROP COLUMN IF EXISTS "serviceFee",
      DROP COLUMN IF EXISTS "itemsTotal";
    `);
  }
}
