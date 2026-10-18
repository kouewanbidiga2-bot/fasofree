import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🏢 Lot 1 — Identité visuelle des sociétés de livraison.
 *
 * POURQUOI : une course confiée à une société partenaire était enregistrée
 * sur la commande (`orders.deliveryProviderId` + `deliveryProviderDetails.agencyName`)
 * mais JAMAIS montrée telle quelle au client : l'app affichait « une agence
 * partenaire ». FasoFree récoltait donc implicitement le mérite (ou le blâme)
 * du travail d'une société tierce.
 *
 * On ajoute ici de quoi identifier et faire reconnaître chaque société :
 *   - logoUrl     : logo affiché au client et au marchand.
 *   - description : présentation libre de la société.
 *   - brandColor  : couleur de marque (#RRGGBB) pour l'habillage.
 *   - website     : vitrine de la société.
 *   - isVerified  : société vérifiée par FasoFree (badge de confiance).
 *
 * Notes de conception (identiques aux migrations précédentes) :
 * - `IF NOT EXISTS` partout : no-op idempotent, compatible avec le
 *   `synchronize` de développement (qui, lui, crée les colonnes depuis l'entité).
 * - Advisory lock : deux instances Render qui bootent ensemble peuvent
 *   exécuter le même DDL.
 * - Toutes les colonnes sont NULLables (sauf `isVerified` avec défaut FALSE) :
 *   aucune agence existante n'est modifiée et le comportement antérieur est
 *   préservé à l'identique (pas de logo = pas de logo, pas d'erreur).
 * - ROLLBACK : destructif, comme toutes les migrations de ce repo.
 */
export class AddAgencyBranding1735000000000 implements MigrationInterface {
  name = 'AddAgencyBranding1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sérialise les boots concurrents (libéré au commit/rollback).
    await queryRunner.query(
      `SELECT pg_advisory_xact_lock(hashtext('agency_branding_1735000000000'))`,
    );

    await queryRunner.query(`
      ALTER TABLE "delivery_agencies"
        ADD COLUMN IF NOT EXISTS "logoUrl" VARCHAR(500),
        ADD COLUMN IF NOT EXISTS "description" TEXT,
        ADD COLUMN IF NOT EXISTS "brandColor" VARCHAR(9),
        ADD COLUMN IF NOT EXISTS "website" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT FALSE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "delivery_agencies"
        DROP COLUMN IF EXISTS "isVerified",
        DROP COLUMN IF EXISTS "website",
        DROP COLUMN IF EXISTS "brandColor",
        DROP COLUMN IF EXISTS "description",
        DROP COLUMN IF EXISTS "logoUrl";
    `);
  }
}
