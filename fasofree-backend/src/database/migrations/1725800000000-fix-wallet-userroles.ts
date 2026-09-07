import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixWalletUserroles1725800000000 implements MigrationInterface {
  name = '1725800000000-fix-wallet-userroles';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix branch wallets that have userRole=DRIVER but belong to a merchant user
    // These were created when the frontend called the branch wallet endpoint
    // with business_admin role, but the role was incorrectly mapped
    await queryRunner.query(`
      UPDATE wallets
      SET "userRole" = 'MERCHANT'
      WHERE "userRole" = 'DRIVER'
        AND "branchId" IS NOT NULL
        AND "userId" IN (
          SELECT id FROM users WHERE role = 'business_admin'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No rollback needed - the original DRIVER role was wrong
  }
}
