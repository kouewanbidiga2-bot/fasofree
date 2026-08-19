import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountVerification1724900000000 implements MigrationInterface {
  name = 'AddAccountVerification1724900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN "isEmailVerified" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN "isPhoneVerified" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN "isEmailVerified"`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN "isPhoneVerified"`);
  }
}
