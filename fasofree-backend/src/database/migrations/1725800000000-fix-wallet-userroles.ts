import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixWalletUserroles1725800000000 implements MigrationInterface {
  name = 'FixWalletUserroles1725800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix branch wallets that have userRole=DRIVER but belong to a merchant user
    // These were created when the frontend called the branch wallet endpoint
    // with business_admin role, but the role was incorrectly mapped
    // ⚠️ Cast ::text des deux côtés : wallets.userId est VARCHAR, users.id est UUID
    // -> sans cast, Postgres rejette avec "operator does not exist: character varying = uuid"
    await queryRunner.query(`
      UPDATE wallets
      SET "userRole" = 'MERCHANT'
      WHERE "userRole" = 'DRIVER'
        AND "branchId" IS NOT NULL
        AND "userId"::text IN (
          SELECT id::text FROM users WHERE role = 'business_admin'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No rollback needed - the original DRIVER role was wrong
  }
}
