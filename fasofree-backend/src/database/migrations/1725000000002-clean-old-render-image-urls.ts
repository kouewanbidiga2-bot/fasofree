import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nettoie les URLs Render (onrender.com) obsolètes dans les colonnes d'images.
 * Les enregistrements NULL seront re-peuplés par le SeedService au prochain démarrage.
 */
export class CleanOldRenderImageUrls1725000000002 implements MigrationInterface {
  name = 'CleanOldRenderImageUrls1725000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nettoyer les logos de businesses pointant vers l'ancien Render
    await queryRunner.query(`
      UPDATE businesses
      SET "logo" = NULL
      WHERE "logo" LIKE '%onrender.com%'
    `);

    // Nettoyer les coverImage de businesses
    await queryRunner.query(`
      UPDATE businesses
      SET "coverImage" = NULL
      WHERE "coverImage" LIKE '%onrender.com%'
    `);

    // Nettoyer les images de produits
    await queryRunner.query(`
      UPDATE products
      SET "imageUrl" = NULL
      WHERE "imageUrl" LIKE '%onrender.com%'
    `);

    // Nettoyer les avatars d'utilisateurs
    await queryRunner.query(`
      UPDATE users
      SET "avatarUrl" = NULL
      WHERE "avatarUrl" LIKE '%onrender.com%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Pas de rollback — les anciennes URLs ne sont plus valides
  }
}
