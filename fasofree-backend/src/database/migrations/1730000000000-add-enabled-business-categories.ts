import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🎛️ Verticales de commerces activables par le Super Admin.
 *
 * Ajoute à `system_settings` :
 *  - `enabledBusinessCategories` : liste JSON des verticales actives
 *    (valeurs BusinessCategory). Par défaut : tout SAUF la pharmacie,
 *    qui s'activera « en temps voulu » depuis Paramètres de la plateforme.
 *
 * Stockage jsonb → cohérent avec `deliveryTiers` / `fasoRidePricing`
 * déjà présents sur cette table singleton.
 *
 * `IF NOT EXISTS` pour rester compatible avec le `synchronize` de dev.
 */
export class AddEnabledBusinessCategories1730000000000
  implements MigrationInterface
{
  name = 'AddEnabledBusinessCategories1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
        ADD COLUMN IF NOT EXISTS "enabledBusinessCategories" jsonb
        NOT NULL DEFAULT '["RESTAURANT","SUPERMARKET","BAKERY","RETAIL","SERVICES"]'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "enabledBusinessCategories";`,
    );
  }
}
