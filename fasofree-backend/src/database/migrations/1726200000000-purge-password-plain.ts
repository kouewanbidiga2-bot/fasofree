import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ✅ FIX #38 — Purge des mots de passe en clair.
 * La colonne passwordPlain stockait le mot de passe non hashé de certains
 * comptes (seed, reset super admin). Le hash bcrypt suffit ; on purge les
 * données sensibles existantes. La colonne elle-même est conservée
 * (nullable, select:false) pour éviter un drop risqué en production.
 */
export class PurgePasswordPlain1726200000000 implements MigrationInterface {
  name = 'PurgePasswordPlain1726200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "users" SET "passwordPlain" = NULL WHERE "passwordPlain" IS NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Non réversible volontairement (les mots de passe en clair ne doivent
    // jamais revenir en base).
  }
}
