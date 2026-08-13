import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKycDocuments1723600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "kyc_documents_type_enum" AS ENUM ('IDENTITY_CARD','DRIVER_LICENSE','VEHICLE_REGISTRATION');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "kyc_documents_status_enum" AS ENUM ('PENDING','APPROVED','REJECTED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "kyc_documents" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "ownerId" uuid NOT NULL,
      "type" "kyc_documents_type_enum" NOT NULL,
      "storageKey" varchar NOT NULL,
      "mimeType" varchar(100) NOT NULL,
      "size" integer NOT NULL,
      "status" "kyc_documents_status_enum" NOT NULL DEFAULT 'PENDING',
      "reviewedBy" uuid,
      "rejectionReason" text,
      "reviewedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_kyc_documents_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_kyc_documents_storage_key" UNIQUE ("storageKey"),
      CONSTRAINT "UQ_kyc_documents_owner_type" UNIQUE ("ownerId", "type")
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_kyc_documents_owner" ON "kyc_documents" ("ownerId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "kyc_documents"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "kyc_documents_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "kyc_documents_type_enum"`);
  }
}
