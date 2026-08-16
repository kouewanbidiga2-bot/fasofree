import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Catalogue de forfaits & abonnements FasoFree
 *
 * 1. Table "subscription_plans" (catalogue piloté par le Super Admin)
 * 2. Colonne "plan" des subscriptions → varchar (codes extensibles STARTER/PRO/VIP)
 * 3. Nouvelle raison de transaction wallet : SUBSCRIPTION_FEE (abonnement VIP / Pro)
 * 4. Seed des forfaits par défaut (idempotent)
 *
 * NB: Tout en "IF NOT EXISTS" pour rester compatible avec le synchronize TypeORM (dev).
 */
export class AddSubscriptionPlansAndFee1724600000000
  implements MigrationInterface
{
  name = 'AddSubscriptionPlansAndFee1724600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 0. Type enum dédié à la table des forfaits
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_plans_subjectType_enum') THEN
          CREATE TYPE "subscription_plans_subjectType_enum" AS ENUM ('CUSTOMER', 'MERCHANT');
        END IF;
      END
      $$;
    `);

    // 1. Table subscription_plans
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscription_plans" (
        "code" character varying(30) NOT NULL,
        "name" character varying(80) NOT NULL,
        "description" text,
        "subjectType" "subscription_plans_subjectType_enum" NOT NULL,
        "priceFcfa" numeric(12,2) NOT NULL DEFAULT 0,
        "durationDays" integer NOT NULL DEFAULT 30,
        "commissionRate" numeric(6,4),
        "freeServiceFee" boolean NOT NULL DEFAULT false,
        "freeDelivery" boolean NOT NULL DEFAULT false,
        "freeDeliveryMinSubtotal" numeric(12,2) NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_plans" PRIMARY KEY ("code")
      );
    `);

    // 2. Subscriptions : plan en varchar (les codes viennent du catalogue)
    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "subscriptions" ALTER COLUMN "plan" TYPE character varying(30);
      EXCEPTION WHEN undefined_column OR duplicate_column THEN
        NULL;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscriptions_plan_enum') THEN
          DROP TYPE IF EXISTS "subscriptions_plan_enum";
        END IF;
      END
      $$;
    `);

    // 3. Nouvelle raison de transaction : SUBSCRIPTION_FEE
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SUBSCRIPTION_FEE') THEN
          ALTER TYPE "wallet_transactions_reason_enum" ADD VALUE 'SUBSCRIPTION_FEE';
        END IF;
      END
      $$;
    `);

    // 4. Seed des forfaits par défaut (idempotent)
    await queryRunner.query(`
      INSERT INTO "subscription_plans"
        ("code", "name", "description", "subjectType", "priceFcfa", "durationDays", "commissionRate", "freeServiceFee", "freeDelivery", "freeDeliveryMinSubtotal", "isActive")
      VALUES
        ('STARTER', 'Starter', 'Plan gratuit pour débuter : commission standard de 5% par commande.', 'MERCHANT', 0, 3650, 0.0500, false, false, 0, true),
        ('PRO', 'Pro', 'Boostez votre commerce : commission réduite à 1,5% par commande.', 'MERCHANT', 5000, 30, 0.0150, false, false, 0, true),
        ('VIP', 'FasoFree Pass VIP', 'Frais de plateforme (100 FCFA/commande) offerts pendant toute la durée.', 'CUSTOMER', 2500, 30, NULL, true, false, 0, true)
      ON CONFLICT ("code") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_plans";`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscriptions_plan_enum') THEN
          CREATE TYPE "subscriptions_plan_enum" AS ENUM ('VIP', 'BOOST_PRO');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ALTER COLUMN "plan" TYPE "subscriptions_plan_enum"
      USING "plan"::"subscriptions_plan_enum";
    `);
  }
}
