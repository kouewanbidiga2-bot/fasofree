import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Matricules produits automatiques — rétro-remplissage des produits existants.
 *
 * La colonne "sku" (varchar, nullable) existe depuis le schéma de base. À
 * partir de maintenant, le backend attribue automatiquement un matricule à la
 * création (ProductsService.create → generateUniqueSku), le restaurateur n'a
 * rien à saisir. Cette migration attribue un matricule stable et unique par
 * commerce aux produits existants sans SKU :
 *
 *   FF-<3 premières lettres de la catégorie>-<8 premiers hex de la business>-<numéro>
 *
 * Le numéro provient d'un row_number par commerce (ordre createdAt, id) :
 * unique par business. Le futur générateur (generateUniqueSku) repart du
 * comptage des produits du commerce, donc aucun doublon avec les matricules
 * attribués ici.
 */
export class BackfillProductSkus1728700000000 implements MigrationInterface {
  name = 'BackfillProductSkus1728700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH numbered AS (
        SELECT
          id,
          row_number() OVER (
            PARTITION BY "businessId"
            ORDER BY "createdAt" ASC, "id" ASC
          ) AS rn
        FROM "products"
      )
      UPDATE "products" p
      SET "sku" =
        'FF-' ||
        upper(substr(coalesce(nullif(p."category", ''), 'GÉNÉRAL'), 1, 3)) ||
        '-' ||
        upper(substr(replace(p."businessId"::text, '-', ''), 1, 8)) ||
        '-' ||
        lpad(n.rn::text, 4, '0')
      FROM numbered n
      WHERE p."id" = n."id"
        AND (p."sku" IS NULL OR p."sku" = '');
    `);
    // NB : le numéro (row_number) compte TOUS les produits du commerce, y
    // compris ceux déjà pourvus d'un SKU → même convention que le générateur
    // du service (count + 1) et rejeu stable : impossible de renuméroter une
    // ligne déjà traitée (le filtre du UPDATE exclut les SKU non vides).
    // Au-delà de 9999 produits/commerce, lpad n'est plus largeur fixe
    // (ex. '10000') — sans impact pour un menu de restaurant.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Pas de rollback : les matricules auto-générés sont persistants et
    // utilisés par la suite (gestion du stock, référencement des produits).
  }
}