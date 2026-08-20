import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBanRequestsAndUserBanMetadata1724950000000 implements MigrationInterface {
  name = 'add-ban-requests-and-user-ban-metadata-1724950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ban metadata on users table
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banReason" text,
      ADD COLUMN IF NOT EXISTS "bannedBy" uuid,
      ADD COLUMN IF NOT EXISTS "bannedAt" timestamp
    `);

    // Ban requests table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ban_requests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "targetUserId" uuid NOT NULL,
        "requestedBy" uuid NOT NULL,
        "reason" text NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "reviewedBy" uuid,
        "reviewNote" text,
        "reviewedAt" timestamp,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_ban_requests_target" FOREIGN KEY ("targetUserId") REFERENCES "users"("id"),
        CONSTRAINT "FK_ban_requests_requester" FOREIGN KEY ("requestedBy") REFERENCES "users"("id"),
        CONSTRAINT "FK_ban_requests_reviewer" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ban_requests_status" ON "ban_requests"("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ban_requests_target" ON "ban_requests"("targetUserId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ban_requests"`);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "banReason",
      DROP COLUMN IF EXISTS "bannedBy",
      DROP COLUMN IF EXISTS "bannedAt"
    `);
  }
}
