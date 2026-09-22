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
    // ⚠️ Sur base vierge, la colonne "passwordPlain" n'existe pas (elle a été
    // retirée de l'entité User). Le garde EXCEPTION undefined_column rend ce
    // bloc no-op dans ce cas : sur une base vierge il n'y a aucun mot de passe
    // en clair à purger.
    await queryRunner.query(`
      DO $$
      BEGIN
        UPDATE "users" SET "passwordPlain" = NULL WHERE "passwordPlain" IS NOT NULL;
      EXCEPTION WHEN undefined_column THEN NULL;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Non réversible volontairement (les mots de passe en clair ne doivent
    // jamais revenir en base).
  }
}
