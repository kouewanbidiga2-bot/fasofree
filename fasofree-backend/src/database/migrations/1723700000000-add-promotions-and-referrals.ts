import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromotionsAndReferrals1723700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "promotions_kind_enum" AS ENUM ('PERCENTAGE','FIXED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "referrals_status_enum" AS ENUM ('REWARDED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralCode" varchar(16)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_referral_code" ON "users" ("referralCode") WHERE "referralCode" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "promotions" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" varchar(32) NOT NULL,
      "kind" "promotions_kind_enum" NOT NULL, "value" numeric(10,2) NOT NULL,
      "minimumOrderAmount" numeric(10,2) NOT NULL DEFAULT 0, "usageLimit" integer,
      "usageCount" integer NOT NULL DEFAULT 0, "startsAt" TIMESTAMP NOT NULL,
      "endsAt" TIMESTAMP NOT NULL, "active" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_promotions_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_promotions_code" UNIQUE ("code")
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "referrals" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "referrerId" uuid NOT NULL,
      "refereeId" uuid NOT NULL, "status" "referrals_status_enum" NOT NULL,
      "rewardAmount" numeric(10,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_referrals_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_referrals_referee" UNIQUE ("refereeId")
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_referrals_referrer" ON "referrals" ("referrerId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "referrals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "promotions"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_referral_code"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "referralCode"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "referrals_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "promotions_kind_enum"`);
  }
}
