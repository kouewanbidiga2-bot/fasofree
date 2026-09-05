import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserAddresses1725550000000 implements MigrationInterface {
  name = 'CreateUserAddresses1725550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_addresses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "label" varchar(50) NOT NULL,
        "address" text NOT NULL,
        "latitude" float,
        "longitude" float,
        "isDefault" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_addresses_userId'
        ) THEN
          ALTER TABLE "user_addresses"
          ADD CONSTRAINT "FK_user_addresses_userId"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'IDX_user_addresses_userId') THEN
          CREATE INDEX "IDX_user_addresses_userId" ON "user_addresses"("userId");
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_addresses";`);
  }
}
