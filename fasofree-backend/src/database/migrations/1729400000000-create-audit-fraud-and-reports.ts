import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🧾🚫📄 Traçabilité financière & anti-fraude
 *
 * 1. `audit_logs`      — journal immuable des actions d'administration
 *                        (qui a supprimé un compte, remboursé, changé un tarif…)
 * 2. `fraud_blocks`    — blocages temporaires anti-fraude (rafales de commandes)
 * 3. `report_exports`  — exports CSV périodiques des transactions (téléchargeables
 *                        depuis le Super Admin)
 *
 * Tout en `IF NOT EXISTS` pour rester compatible avec le `synchronize` de dev.
 */
export class CreateAuditFraudAndReports1729400000000 implements MigrationInterface {
  name = 'CreateAuditFraudAndReports1729400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Journal d'audit ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actorId" uuid,
        "actorEmail" character varying,
        "actorRole" character varying,
        "action" character varying NOT NULL,
        "entityType" character varying,
        "entityId" character varying,
        "httpMethod" character varying,
        "path" character varying,
        "ip" character varying,
        "userAgent" character varying,
        "payload" jsonb,
        "result" character varying NOT NULL DEFAULT 'SUCCESS',
        "statusCode" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_createdAt" ON "audit_logs" ("createdAt");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action" ON "audit_logs" ("action");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_actorId" ON "audit_logs" ("actorId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entity" ON "audit_logs" ("entityType", "entityId");`,
    );

    // Le journal ne doit jamais être réécrit : on bloque UPDATE/DELETE au niveau DB.
    // Même approche que les triggers de protection du super admin (1728300000000).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs est un journal en écriture seule (immuable)';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_logs_immutable') THEN
          CREATE TRIGGER "trg_audit_logs_immutable"
            BEFORE UPDATE OR DELETE ON "audit_logs"
            FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
        END IF;
      END $$;
    `);

    // ── 2. Blocages anti-fraude ────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fraud_blocks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying,
        "phone" character varying,
        "rule" character varying NOT NULL,
        "reason" text,
        "orderCount" integer,
        "windowMinutes" integer,
        "blockedUntil" TIMESTAMP NOT NULL,
        "releasedAt" TIMESTAMP,
        "releasedBy" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fraud_blocks_id" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_fraud_blocks_userId" ON "fraud_blocks" ("userId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_fraud_blocks_phone" ON "fraud_blocks" ("phone");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_fraud_blocks_blockedUntil" ON "fraud_blocks" ("blockedUntil");`,
    );

    // ── 3. Exports CSV ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_exports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kind" character varying NOT NULL DEFAULT 'TRANSACTIONS_CSV',
        "periodStart" TIMESTAMP NOT NULL,
        "periodEnd" TIMESTAMP NOT NULL,
        "fileName" character varying NOT NULL,
        "rowCount" integer NOT NULL DEFAULT 0,
        "truncated" boolean NOT NULL DEFAULT false,
        "csvContent" text NOT NULL,
        "summary" jsonb,
        "generatedBy" character varying NOT NULL DEFAULT 'CRON',
        "downloadedAt" TIMESTAMP,
        "downloadCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_exports_id" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_report_exports_kind_created" ON "report_exports" ("kind", "createdAt");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_audit_logs_immutable" ON "audit_logs";
    `);
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_logs_immutable();`);
    await queryRunner.query(`DROP TABLE IF EXISTS "report_exports";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fraud_blocks";`);
    // Le journal part avec la table : il ne doit jamais être effacé, d'où
    // l'absence de DROP TABLE ici. (down volontairement non destructif.)
  }
}
