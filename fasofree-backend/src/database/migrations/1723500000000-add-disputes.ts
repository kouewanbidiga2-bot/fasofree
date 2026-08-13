import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisputes1723500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "disputes_status_enum" AS ENUM ('OPEN','UNDER_REVIEW','RESOLVED_REFUND','RESOLVED_REJECTED','CLOSED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "disputes_resolution_enum" AS ENUM ('REFUND','REJECT');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await queryRunner.query(
      `ALTER TYPE "merchant_payouts_status_enum" ADD VALUE IF NOT EXISTS 'BLOCKED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "transactions_status_enum" ADD VALUE IF NOT EXISTS 'refund_pending'`,
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "disputes" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "orderId" uuid NOT NULL,
      "clientId" uuid NOT NULL,
      "reason" text NOT NULL,
      "attachments" jsonb NOT NULL DEFAULT '[]',
      "status" "disputes_status_enum" NOT NULL DEFAULT 'OPEN',
      "assignedAdminId" uuid,
      "adminNote" text,
      "resolution" "disputes_resolution_enum",
      "resolvedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_disputes_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_disputes_order" UNIQUE ("orderId")
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_disputes_client" ON "disputes" ("clientId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "disputes"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "disputes_resolution_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "disputes_status_enum"`);
  }
}
