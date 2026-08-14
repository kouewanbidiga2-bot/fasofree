import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Ajout du type de commande et des champs P2P (Course à la demande)
 *
 * Champs ajoutés:
 * - orderType: ENUM (MERCHANT par défaut, P2P_DELIVERY, DELIVERY, PICKUP, RIDE, EXPRESS)
 * - pickupLocation: JSONB (adresse + GPS + contact du ramassage)
 * - dropoffLocation: JSONB (adresse + GPS + contact de la livraison)
 * - packageDetails: JSONB (description, isFragile, weight, dimensions)
 *
 * NB: Colonnes ajoutées en mode "IF NOT EXISTS" pour rester compatible avec
 * le synchronize TypeORM utilisé en développement.
 */
export class AddOrderTypeAndP2PFields1724400000000 implements MigrationInterface {
  name = 'AddOrderTypeAndP2PFields1724400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Créer l'enum orderType s'il n'existe pas encore
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orders_orderType_enum') THEN
          CREATE TYPE "orders_orderType_enum" AS ENUM (
            'MERCHANT',
            'P2P_DELIVERY',
            'DELIVERY',
            'PICKUP',
            'RIDE',
            'EXPRESS'
          );
        END IF;
      END
      $$;
    `);

    // 2. Ajouter la colonne orderType (défaut MERCHANT) si absente
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "orderType" "orders_orderType_enum" NOT NULL DEFAULT 'MERCHANT';
    `);

    // 3. Forcer le défaut à MERCHANT (au cas où la colonne préexistait avec un autre défaut)
    await queryRunner.query(`
      ALTER TABLE "orders" ALTER COLUMN "orderType" SET DEFAULT 'MERCHANT';
    `);

    // 4. Ajouter les champs P2P (JSONB, optionnels)
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "pickupLocation" JSONB,
      ADD COLUMN IF NOT EXISTS "dropoffLocation" JSONB,
      ADD COLUMN IF NOT EXISTS "packageDetails" JSONB;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "packageDetails",
      DROP COLUMN IF EXISTS "dropoffLocation",
      DROP COLUMN IF EXISTS "pickupLocation",
      DROP COLUMN IF EXISTS "orderType";
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS "orders_orderType_enum";`);
  }
}
