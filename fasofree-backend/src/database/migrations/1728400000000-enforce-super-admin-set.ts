import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🔒 Verrouillage du jeu de Super Admins (set immuable de 2 comptes).
 *
 * Garantit, quelle que soit la source (API, seed, script interne, requête SQL
 * directe, future migration mal écrite) :
 *   1. Seul le compte MAÎTRE (id stable + email bidigaimrane7@gmail.com) et le
 *      compte COLLABORATEUR (email franckrayan226@gmail.com) peuvent avoir le
 *      rôle SUPER_ADMIN — toute tentative d'en créer un troisième est bloquée
 *      (INSERT / UPDATE).
 *   2. Le maître et le collaborateur sont INrétrogradables (UPDATE rôle ≠
 *      SUPER_ADMIN bloqué) — y compris par un autre super admin.
 *   3. Aucun compte SUPER_ADMIN ne peut être SUPPRIMÉ (DELETE) — les deux
 *      comptes sont permanents.
 *   4. TRUNCATE de users bloqué tant que le maître OU le collaborateur existe
 *      (fonction existante étendue au collaborateur).
 *
 * Complète la migration 1728300000000 (protection du maître seul).
 * Idempotent : CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
 */
export class EnforceSuperAdminSet1728400000000 implements MigrationInterface {
  name = 'EnforceSuperAdminSet1728400000000';

  private readonly masterId = 'e22f06f8-451d-4c78-b6bb-b31ce3d85f6b';
  private readonly masterEmail = 'bidigaimrane7@gmail.com';
  private readonly collaboratorEmail = 'franckrayan226@gmail.com';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Trigger LIGNE : verrouille le JEU de super admins (INSERT/UPDATE/DELETE)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION fn_enforce_super_admin_set()
      RETURNS trigger AS $fn$
      DECLARE
        is_master BOOLEAN;
        is_collab BOOLEAN;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          IF OLD.role::text = 'super_admin' THEN
            RAISE EXCEPTION 'Compte protégé : suppression d''un super admin interdite';
          END IF;
          RETURN OLD;
        END IF;

        is_master := (NEW.id = '${this.masterId}' AND NEW.email = '${this.masterEmail}');
        is_collab := (NEW.email = '${this.collaboratorEmail}');

        -- Règle 1 : personne d'autre ne peut devenir super_admin
        IF NEW.role::text = 'super_admin' AND NOT (is_master OR is_collab) THEN
          RAISE EXCEPTION 'Accès refusé : seuls le maître et le collaborateur peuvent être super_admin';
        END IF;

        -- Règle 2 : les comptes protégés sont inrétrogradables
        IF (is_master OR is_collab) AND NEW.role::text IS DISTINCT FROM 'super_admin' THEN
          RAISE EXCEPTION 'Rétrogradation interdite : compte protégé (maître/collaborateur)';
        END IF;

        RETURN NEW;
      END;
      $fn$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_enforce_super_admin_set ON "users";
      CREATE TRIGGER trg_enforce_super_admin_set
        BEFORE INSERT OR UPDATE OR DELETE ON "users"
        FOR EACH ROW
        EXECUTE FUNCTION fn_enforce_super_admin_set();
    `);

    // 2) Étend le garde TRUNCATE au collaborateur (il bloque déjà le maître).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION fn_protect_master_super_admin_truncate()
      RETURNS trigger AS $fn$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "users"
          WHERE id = '${this.masterId}'
             OR email IN ('${this.masterEmail}', '${this.collaboratorEmail}')
        ) THEN
          RAISE EXCEPTION 'Compte protégé (maître/collaborateur) : TRUNCATE interdit';
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
      DROP TRIGGER IF EXISTS trg_enforce_super_admin_set ON "users";
      DROP FUNCTION IF EXISTS fn_enforce_super_admin_set();

      -- Restaure le garde TRUNCATE à son état d'origine (maître seul).
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
}