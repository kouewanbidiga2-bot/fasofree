import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🔗📣 Affiliation marchand + campagnes push
 *
 * 1. `affiliate_links`      — lien court de suivi par commerce (code unique)
 * 2. `affiliate_events`     — événements du funnel (CLICK / SIGNUP / ORDER)
 * 3. `push_campaigns`       — campagnes push ciblées par rôle
 * 4. `users.affiliateCode`  — code affilié du client (attribution persistée)
 *
 * Tout en `IF NOT EXISTS` pour rester compatible avec le `synchronize` de dev
 * (qui aura déjà créé ces tables en local).
 */
export class CreateAffiliateAndPushCampaigns1729500000000 implements MigrationInterface {
  name = 'CreateAffiliateAndPushCampaigns1729500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Liens de suivi ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "affiliate_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "businessId" uuid NOT NULL,
        "code" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_affiliate_links_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_affiliate_links_code" UNIQUE ("code")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_affiliate_links_business" ON "affiliate_links" ("businessId");`,
    );

    // ── 2. Événements du funnel ─────────────────────────────────────
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'affiliate_events_type_enum') THEN
          CREATE TYPE "affiliate_events_type_enum" AS ENUM('CLICK', 'SIGNUP', 'ORDER');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "affiliate_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "linkId" uuid,
        "businessId" uuid NOT NULL,
        "type" "affiliate_events_type_enum" NOT NULL,
        "userId" uuid,
        "orderId" uuid,
        "amount" numeric(12,2),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_affiliate_events_id" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_affiliate_events_business_type" ON "affiliate_events" ("businessId", "type");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_affiliate_events_link_type" ON "affiliate_events" ("linkId", "type");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_affiliate_events_businessId" ON "affiliate_events" ("businessId");`,
    );
    // Une commande donnée ne doit alimenter le funnel qu'une seule fois.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_affiliate_events_order_unique"
        ON "affiliate_events" ("orderId")
        WHERE "orderId" IS NOT NULL AND "type" = 'ORDER';
    `);

    // ── 3. Campagnes push ───────────────────────────────────────────
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'push_campaigns_target_enum') THEN
          CREATE TYPE "push_campaigns_target_enum" AS ENUM('ALL', 'CLIENT', 'DRIVER', 'MERCHANT');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "push_campaigns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(200) NOT NULL,
        "body" character varying(1000) NOT NULL,
        "target" "push_campaigns_target_enum" NOT NULL DEFAULT 'ALL',
        "sentBy" character varying(200),
        "recipientCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_campaigns_id" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_push_campaigns_createdAt" ON "push_campaigns" ("createdAt");`,
    );

    // ── 4. Code affilié du client ────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "affiliateCode" character varying(32);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_affiliateCode" ON "users" ("affiliateCode");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_affiliateCode";`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "affiliateCode";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "push_campaigns";`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "push_campaigns_target_enum";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "affiliate_events";`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "affiliate_events_type_enum";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "affiliate_links";`);
  }
}
