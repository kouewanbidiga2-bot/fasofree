import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Correction du trigger de protection du compte maître : il retournait
 * `NEW` — NULL sur un DELETE — ce qui annulait silencieusement TOUS les
 * suppressions de la table « users » (0 ligne supprimée, réponse API
 * « supprimé » quand même).
 *
 * Conséquence observée : la suppression d'un utilisateur depuis le
 * tableau de bord superadmin renvoyait 200 mais le compte restait en base.
 *
 * La protection du compte maître est conservée (la branche DELETE lève une
 * exception) ; pour tout autre compte, `OLD` est maintenant renvoyé et la
 * suppression a lieu.
 */
export class FixUserDeleteTrigger1728600000000 implements MigrationInterface {
  name = 'FixUserDeleteTrigger1728600000000';

  private readonly masterId = 'e22f06f8-451d-4c78-b6bb-b31ce3d85f6b';
  private readonly masterEmail = 'bidigaimrane7@gmail.com';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION fn_protect_master_super_admin()
      RETURNS trigger AS $fn$
      BEGIN
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

        -- DELETE : NEW est NULL, il faut renvoyer OLD sinon l'opération
        -- est annulée silencieusement (bug corrigé).
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;

        RETURN NEW;
      END;
      $fn$ LANGUAGE plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Nouvelle définition conservée : aucun retour au comportement défaillant.
    await queryRunner.query(`SELECT 1;`);
  }
}
