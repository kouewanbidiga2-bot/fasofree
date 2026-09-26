import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unicité des matricules produits.
 *
 * Garantit en base la non-duplication des SKU (générés automatiquement par
 * la plateforme ou saisis par le restaurateur) → l'insertion concurrente de
 * deux produits ne peut plus produire deux fois le même matricule
 * (ProductsService.create gère le retry côté service sur code 23505).
 *
 * Index unique PARTIEL : uniquement sur les SKU non vides (les colonnes
 * NULL/'' restent autorisées à coexister, conformément au schéma existant).
 *
 * Pré-contrôle : si des doublons de SKU personnalisés existent déjà (saisie
 * manuelle historique), l'index n'est PAS créé — on ne veut jamais casser le
 * démarrage en production pour une contrainte cosmétique ; le générateur du
 * service reste fiable (sonde findOne + retry).
 */
export class AddProductsSkuUnique1728800000000 implements MigrationInterface {
  name = 'AddProductsSkuUnique1728800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $do$
      DECLARE dup_count INTEGER;
      BEGIN
        -- 🔒 Verrou anti-course (TOCTOU) : bloque les writers pendant le
        -- pré-contrôle pour garantir que le SELECT et le CREATE UNIQUE INDEX
        -- voient le même état (table de taille menu → blocage en millisecondes).
        LOCK TABLE "products" IN SHARE ROW EXCLUSIVE MODE;

        SELECT count(*) INTO dup_count
        FROM (
          SELECT "sku"
          FROM "products"
          WHERE "sku" IS NOT NULL AND "sku" <> ''
          GROUP BY "sku"
          HAVING count(*) > 1
        ) d;

        IF dup_count = 0 THEN
          CREATE UNIQUE INDEX IF NOT EXISTS "IDX_products_sku_unique"
            ON "products" ("sku")
            WHERE "sku" IS NOT NULL AND "sku" <> '';
        ELSE
          RAISE NOTICE 'IDX_products_sku_unique NON créé : % SKU en doublon — unicité non garantie en base (le générateur du service reste fiable)', dup_count;
        END IF;
      END $do$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_sku_unique"`);
  }
}