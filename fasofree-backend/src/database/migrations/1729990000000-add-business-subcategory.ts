import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🏷️ Sous-catégorie des commerces (niveau 2 du catalogue).
 *
 * Ajoute à `businesses` :
 *  - `subCategory` : « Fast-Food », « Cuisine Locale », « Épicerie »…
 *                    NULL = non renseignée (rétro-compatible).
 *
 * Le niveau 1 est la colonne `category` (enum) déjà existante.
 * L'index composite sert au filtre client `(category, subCategory)`.
 *
 * Tout en `IF NOT EXISTS` pour rester compatible avec le `synchronize` de dev.
 */
export class AddBusinessSubCategory1729990000000 implements MigrationInterface {
  name = 'AddBusinessSubCategory1729990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "businesses"
        ADD COLUMN IF NOT EXISTS "subCategory" varchar(60);
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_businesses_category_subCategory" ON "businesses" ("category", "subCategory");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_businesses_category_subCategory";`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "subCategory";`,
    );
  }
}
