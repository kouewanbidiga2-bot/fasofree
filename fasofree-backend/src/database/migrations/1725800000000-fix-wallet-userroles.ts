import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixWalletUserroles1725800000000 implements MigrationInterface {
  name = 'FixWalletUserroles1725800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guard : wallets est créée plus tard (1726100000000) sur une base neuve.
    const tbl = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables WHERE table_name = 'wallets'
    `);
    if (tbl.length === 0) return;

    // Fix branch wallets that have userRole=DRIVER but belong to a merchant user
    // These were created when the frontend called the branch wallet endpoint
    // with business_admin role, but the role was incorrectly mapped
    // ⚠️ Cast ::text des deux côtés : wallets.userId est VARCHAR, users.id est UUID
    // -> sans cast, Postgres rejette avec "operator does not exist: character varying = uuid"
    // ⚠️ Sur base vierge, la table "wallets" n'existe pas encore (créée par
    // 1726100000000, postérieure). Le garde EXCEPTION undefined_table rend ce
    // bloc no-op dans ce cas — sur une base vierge il n'y a aucune donnée à corriger.
    await queryRunner.query(`
      DO $$
      BEGIN
        UPDATE wallets
        SET "userRole" = 'MERCHANT'
        WHERE "userRole" = 'DRIVER'
          AND "branchId" IS NOT NULL
          AND "userId"::text IN (
            SELECT id::text FROM users WHERE role = 'business_admin'
          );
      EXCEPTION WHEN undefined_table THEN NULL;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No rollback needed - the original DRIVER role was wrong
  }
}
