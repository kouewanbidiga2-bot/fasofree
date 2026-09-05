import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateDisputeStatusEnum1724300000000 implements MigrationInterface {
  name = 'UpdateDisputeStatusEnum1724300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "disputes"
      ADD COLUMN IF NOT EXISTS "supportAgentId" UUID,
      ADD COLUMN IF NOT EXISTS "supportNote" TEXT,
      ADD COLUMN IF NOT EXISTS "refundAmount" DECIMAL(10, 2);
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_disputes_supportAgentId') THEN
          CREATE INDEX "idx_disputes_supportAgentId" ON "disputes"("supportAgentId");
        END IF;
      END $$;
    `);
    await queryRunner.query(`ALTER TABLE "disputes" ALTER COLUMN "status" TYPE VARCHAR(50);`);
    await queryRunner.query(`
      UPDATE "disputes" SET "status" = 'UNDER_INVESTIGATION' WHERE "status" = 'UNDER_REVIEW';
      UPDATE "disputes" SET "status" = 'APPROVED' WHERE "status" = 'RESOLVED_REFUND';
      UPDATE "disputes" SET "status" = 'REJECTED' WHERE "status" = 'RESOLVED_REJECTED';
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "disputes" ADD CONSTRAINT "CK_disputes_status"
        CHECK ("status" IN ('OPEN','UNDER_INVESTIGATION','PENDING_ADMIN_APPROVAL','APPROVED','REJECTED','CLOSED'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "disputes" DROP CONSTRAINT IF EXISTS "CK_disputes_status";`);
    await queryRunner.query(`
      UPDATE "disputes" SET "status" = 'UNDER_REVIEW' WHERE "status" = 'UNDER_INVESTIGATION';
      UPDATE "disputes" SET "status" = 'RESOLVED_REFUND' WHERE "status" = 'APPROVED';
      UPDATE "disputes" SET "status" = 'RESOLVED_REJECTED' WHERE "status" = 'REJECTED';
    `);
    await queryRunner.query(`ALTER TABLE "disputes" ALTER COLUMN "status" TYPE VARCHAR(50);`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_disputes_supportAgentId";`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN IF EXISTS "refundAmount", DROP COLUMN IF EXISTS "supportNote", DROP COLUMN IF EXISTS "supportAgentId";`);
  }
}
