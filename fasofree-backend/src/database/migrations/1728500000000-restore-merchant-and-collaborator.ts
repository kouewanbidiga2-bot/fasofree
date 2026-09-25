import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Scission du compte superadmin collaborateur et de la candidature marchand
 * « la notche ».
 *
 * Constat : la candidature marchand (id 3b01957a..., businessName « la notche »)
 * se retrouvait portée par le compte SUPER_ADMIN collaborateur
 * (franckrayan226@gmail.com) — conséquence d'un renommage d'email sur un compte
 * qui était pourtant une candidature marchand. Deux comptes étaient donc
 * confondus en un seul :
 *   - la candidature marchand est inapprouvable (le trigger EnforceSuperAdminSet
 *     interdit toute rétrogradation du collaborateur) ;
 *   - le collaborateur n'existait plus comme compte indépendant.
 *
 * Correction (une seule fois, idempotente) :
 *   1. le téléphone devient nullable — l'unicité du numéro est portée par le
 *      marchand, le collaborateur se connecte par email ;
 *   2. la candidature marchand repasse sur son email d'origine
 *      (franckbado45@gmail.com) avec le rôle business_admin, ce qui la rend
 *      à nouveau approuvable par l'administration ;
 *   3. le compte collaborateur (franckrayan226@gmail.com) est ensuite recréé
 *      par ensureCollaboratorAccount() au démarrage de l'application.
 */
export class RestoreMerchantAndCollaborator1728500000000
  implements MigrationInterface
{
  name = 'RestoreMerchantAndCollaborator1728500000000';

  private readonly merchantId = '3b01957a-6a2f-4386-9381-64f571c0e466';
  private readonly merchantEmail = 'franckbado45@gmail.com';
  private readonly collaboratorEmail = 'franckrayan226@gmail.com';
  private readonly collaboratorId = 'b8f3d2e7-4a19-4c6b-9f2d-7c5e1a03b844';
  // bcrypt(10) de « Attieke25# » — même mot de passe qu'auparavant.
  private readonly collaboratorPasswordHash =
    '$2b$10$6axLLXU3u9L/.Om7SXtb3eCy9wuwicthh2uRu6uLbLv5GGyDCDq5O';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Téléphone nullable (le collaborateur n'a pas de numéro libre :
    //    l'unicité de la colonne est déjà portée par le numéro du marchand).
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;`,
    );

    // 2) Retour de la candidature marchand sur son email d'origine, ce qui la
    //    rend à nouveau approuvable (le trigger EnforceSuperAdminSet interdit
    //    toute rétrogradation du collaborateur).
    //    NOT EXISTS évite une collision d'email (idempotence).
    await queryRunner.query(
      `
        UPDATE "users"
        SET "email" = '${this.merchantEmail}',
            "role" = 'business_admin'
        WHERE "id" = '${this.merchantId}'
          AND "email" = '${this.collaboratorEmail}'
          AND "role" = 'super_admin'
          AND NOT EXISTS (
            SELECT 1 FROM "users" u WHERE u."email" = '${this.merchantEmail}'
          );
      `,
    );

    // 3) Recréation du compte collaborateur (email désormais libre), mot de
    //    passe identique à celui en vigueur. Non reprise par
    //    ensureCollaboratorAccount() si elle tourne avant : l'email existe.
    await queryRunner.query(
      `
        INSERT INTO "users" (
          "id", "fullName", "email", "phone", "passwordHash", "role",
          "isActive", "isEmailVerified", "isPhoneVerified",
          "createdAt", "updatedAt"
        )
        SELECT
          '${this.collaboratorId}', 'BADO Franck Rayan',
          '${this.collaboratorEmail}', NULL, '${this.collaboratorPasswordHash}',
          'super_admin', true, true, false, now(), now()
        WHERE NOT EXISTS (
          SELECT 1 FROM "users" u WHERE u."email" = '${this.collaboratorEmail}'
        );
      `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Régression impossible sans perdre les comptes créés sans numéro
    // (collaborateur) : la colonne reste nullable.
    await queryRunner.query(`SELECT 1;`);
  }
}
