import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuperAdminWalletRole1726300000000 implements MigrationInterface {
  name = 'AddSuperAdminWalletRole1726300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ajouter la valeur SUPER_ADMIN à l'enum PostgreSQL existant
    // Guard : l'enum peut manquer sur une base où wallets n'existe pas encore.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "wallets_userrole_enum" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
      EXCEPTION WHEN undefined_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL ne supporte pas REMOVE VALUE sur un enum.
    // Rollback manuel si nécessaire : recréer l'enum sans SUPER_ADMIN + migrer les données.
  }
}
