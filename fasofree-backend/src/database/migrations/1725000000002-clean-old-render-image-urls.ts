import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nettoie les URLs Render (onrender.com) obsolètes dans les colonnes d'images.
 * Les enregistrements NULL seront re-peuplés par le SeedService au prochain démarrage.
 */
export class CleanOldRenderImageUrls1725000000002 implements MigrationInterface {
  name = 'CleanOldRenderImageUrls1725000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guard : tables créées plus tard / absentes sur certaines bases anciennes.
    const businesses = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'businesses'`,
    );
    const products = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'products'`,
    );
    const users = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'users'`,
    );

    if (businesses.length > 0) {
      await queryRunner.query(`
        UPDATE businesses
        SET "logo" = NULL
        WHERE "logo" LIKE '%onrender.com%'
      `);
      await queryRunner.query(`
        UPDATE businesses
        SET "coverImage" = NULL
        WHERE "coverImage" LIKE '%onrender.com%'
      `);
    }

    if (products.length > 0) {
      await queryRunner.query(`
        UPDATE products
        SET "imageUrl" = NULL
        WHERE "imageUrl" LIKE '%onrender.com%'
      `);
    }

    if (users.length > 0) {
      await queryRunner.query(`
        UPDATE users
        SET "avatarUrl" = NULL
        WHERE "avatarUrl" LIKE '%onrender.com%'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Pas de rollback — les anciennes URLs ne sont plus valides
  }
}
