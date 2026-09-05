import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountVerification1724900000000 implements MigrationInterface {
  name = 'AddAccountVerification1724900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "isEmailVerified" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "isPhoneVerified" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS "isEmailVerified"`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS "isPhoneVerified"`);
  }
}
