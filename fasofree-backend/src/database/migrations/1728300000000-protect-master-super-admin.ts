import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🔒 Protection du compte maître « BIDIGA Imrane » (bidigaimrane7@gmail.com).
 *
 * Des triggers PostgreSQL empêchent — quelle que soit la source (API, script
 * interne, requête SQL directe, future migration mal écrite) — de :
 *   - SUPPRIMER le compte maître (DELETE) ;
 *   - TRUNCATE la table users tant que le compte maître existe ;
 *   - changer son id ou son email (identité) ;
 *   - changer son rôle hors de SUPER_ADMIN ;
 *   - le désactiver (isActive = false).
 *
 * Les changements de mot de passe (passwordHash) restent autorisés
 * (réinitialisation légitime via l'API / le bootstrap).
 * Idempotent : CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
 */
export class ProtectMasterSuperAdmin1728300000000 implements MigrationInterface {
  name = 'ProtectMasterSuperAdmin1728300000000';

  private readonly masterId = 'e22f06f8-451d-4c78-b6bb-b31ce3d85f6b';
  private readonly masterEmail = 'bidigaimrane7@gmail.com';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Trigger LIGNE : bloque DELETE / changement d'id / email / rôle / désactivation
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION fn_protect_master_super_admin()
      RETURNS trigger AS $fn$
      BEGIN
        -- Identité du compte maître : id stable OU email identifiant.
        IF (OLD.id = '${this.masterId}' OR OLD.email = '${this.masterEmail}') THEN
          IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Compte maître protégé : suppression interdite';
          END IF;
          IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Compte maître protégé : changement d''identifiant interdit';
          END IF;
          IF NEW.email IS DISTINCT FROM OLD.email THEN
            RAISE EXCEPTION 'Compte maître protégé : changement d''email interdit';
          END IF;
          IF NEW.role::text IS DISTINCT FROM 'super_admin' THEN
            RAISE EXCEPTION 'Compte maître protégé : rétrogradation interdite';
          END IF;
          IF NEW.isActive IS NOT TRUE THEN
            RAISE EXCEPTION 'Compte maître protégé : désactivation interdite';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $fn$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_protect_master_super_admin ON "users";
      CREATE TRIGGER trg_protect_master_super_admin
        BEFORE DELETE OR UPDATE ON "users"
        FOR EACH ROW
        EXECUTE FUNCTION fn_protect_master_super_admin();
    `);

    // 2) Trigger TRUNCATE : les triggers row ne couvrent pas TRUNCATE.
    //    Bloque uniquement tant que le compte maître existe (base vierge OK).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION fn_protect_master_super_admin_truncate()
      RETURNS trigger AS $fn$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "users"
          WHERE id = '${this.masterId}' OR email = '${this.masterEmail}'
        ) THEN
          RAISE EXCEPTION 'Compte maître protégé : TRUNCATE interdit';
        END IF;
        RETURN NULL;
      END;
      $fn$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_protect_master_super_admin_truncate ON "users";
      CREATE TRIGGER trg_protect_master_super_admin_truncate
        BEFORE TRUNCATE ON "users"
        FOR EACH STATEMENT
        EXECUTE FUNCTION fn_protect_master_super_admin_truncate();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_protect_master_super_admin ON "users";
      DROP TRIGGER IF EXISTS trg_protect_master_super_admin_truncate ON "users";
      DROP FUNCTION IF EXISTS fn_protect_master_super_admin();
      DROP FUNCTION IF EXISTS fn_protect_master_super_admin_truncate();
    `);
  }
}