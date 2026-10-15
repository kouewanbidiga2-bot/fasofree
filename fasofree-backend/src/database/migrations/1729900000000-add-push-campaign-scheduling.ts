import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ⏱️📣 Programmation des campagnes push
 *
 * Ajoute à `push_campaigns` :
 *  - `status`         : SENT | SCHEDULED (défaut SENT → rétro-compatible)
 *  - `scheduledAt`    : date de diffusion, NULL = envoi immédiat
 *  - `targetedCount`  : nb de comptes correspondant à la cible (diagnostic :
 *                       distingue « personne ciblé » de « envoi en échec »)
 *
 * Tout en `IF NOT EXISTS` pour rester compatible avec le `synchronize` de dev.
 */
export class AddPushCampaignScheduling1729900000000
  implements MigrationInterface
{
  name = 'AddPushCampaignScheduling1729900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'push_campaigns_status_enum') THEN
          CREATE TYPE "push_campaigns_status_enum" AS ENUM('SCHEDULED', 'SENT');
        END IF;
      END $$;
    `);

    // `status` — les campagnes existantes restent SENT (déjà diffusées).
    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "status" "push_campaigns_status_enum" NOT NULL DEFAULT 'SENT';
    `);

    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP WITH TIME ZONE;
    `);

    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "targetedCount" integer NOT NULL DEFAULT 0;
    `);

    // Le cron cherche les campagnes SCHEDULED dont l'heure est dépassée.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_push_campaigns_status_scheduledAt" ON "push_campaigns" ("status", "scheduledAt");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_push_campaigns_status_scheduledAt";`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_campaigns" DROP COLUMN IF EXISTS "targetedCount";`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_campaigns" DROP COLUMN IF EXISTS "scheduledAt";`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_campaigns" DROP COLUMN IF EXISTS "status";`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "push_campaigns_status_enum";`,
    );
  }
}