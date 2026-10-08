import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🧭 Dispatch multi-niveaux (Delivery Providers / Fallback)
 *
 * - Table `delivery_agencies` (Niveau 2 : agences partenaires)
 * - Colonnes de suivi provider sur `orders` (provider, ref externe,
 *   statut, commission agence)
 * - Colonne `agencyId` sur `users` (comptes AGENCY + chauffeurs
 *   rattachés à une flotte partenaire)
 * - Valeur 'agency' dans l'enum des rôles utilisateurs
 *
 * ⚠️ Aucune donnée existante n'est modifiée : toutes les colonnes
 * sont NULLables / à défaut, le comportement reste identique tant que
 * DELIVERY_PROVIDERS vaut 'internal' (défaut).
 */
export class AddDeliveryProviders1729200000000 implements MigrationInterface {
  name = 'AddDeliveryProviders1729200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Table des agences partenaires ───────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "delivery_agencies" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" VARCHAR(150) NOT NULL,
        "phone" VARCHAR(20),
        "email" VARCHAR(150),
        "zones" JSONB,
        "commissionPct" NUMERIC(5,2) NOT NULL DEFAULT 10,
        "maxConcurrentDeliveries" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "userId" UUID,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Utilisateurs : rattachement à une agence ────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'users'::regclass AND attname = 'agencyId') THEN
          ALTER TABLE "users" ADD COLUMN "agencyId" UUID;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_agency') THEN
          ALTER TABLE "users"
            ADD CONSTRAINT "fk_users_agency"
            FOREIGN KEY ("agencyId") REFERENCES "delivery_agencies"("id")
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_agency_id') THEN
          CREATE INDEX "idx_users_agency_id" ON "users"("agencyId");
        END IF;
      END $$;
    `);

    // ── Commandes : suivi du provider de livraison ──────────────
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "deliveryProvider" VARCHAR(32),
        ADD COLUMN IF NOT EXISTS "deliveryProviderId" UUID,
        ADD COLUMN IF NOT EXISTS "deliveryExternalRef" VARCHAR(128),
        ADD COLUMN IF NOT EXISTS "deliveryProviderStatus" VARCHAR(32),
        ADD COLUMN IF NOT EXISTS "deliveryProviderDetails" JSONB,
        ADD COLUMN IF NOT EXISTS "deliveryProviderTriedAt" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "agencyCommissionXof" NUMERIC(12,2);
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_delivery_provider_id') THEN
          CREATE INDEX "idx_orders_delivery_provider_id" ON "orders"("deliveryProviderId");
        END IF;
      END $$;
    `);

    // ── Rôle AGENCY ─────────────────────────────────────────────
    // (PG ≥ 12 : la valeur peut être ajoutée dans la transaction,
    //  elle n'est simplement pas utilisable dans la même requête)
    await queryRunner.query(
      `ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'agency';`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_delivery_provider_id";`);
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "agencyCommissionXof",
        DROP COLUMN IF EXISTS "deliveryProviderTriedAt",
        DROP COLUMN IF EXISTS "deliveryProviderDetails",
        DROP COLUMN IF EXISTS "deliveryProviderStatus",
        DROP COLUMN IF EXISTS "deliveryExternalRef",
        DROP COLUMN IF EXISTS "deliveryProviderId",
        DROP COLUMN IF EXISTS "deliveryProvider";
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_agency_id";`);
    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "fk_users_agency";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "agencyId";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "delivery_agencies";`);
    // Note : la valeur 'agency' ne peut pas être retirée de l'enum PG
    // (ALTER TYPE ... REMOVE VALUE n'existe pas) — sans impact.
  }
}
