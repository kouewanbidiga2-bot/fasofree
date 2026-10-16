import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🚚 Lot 1 — Appel d'offres multi-agences + suivi SLA + pénalités qualité.
 *
 * 1) `orders` — suivi du temps de livraison (bloc B) :
 *    - `deliveredAt`             : remise réelle du colis (validation livreur)
 *    - `deliveryEtaMinutes`      : ETA annoncée (distance ÷ 30 km/h, +30 % en
 *                                  heures de pointe, plancher 15 min)
 *    - `deliverySlaDeadline`     : échéance de retard (ETA + tolérance 25 %)
 *    - `deliveryDurationMinutes` : durée réelle de la course
 *    - `deliveryLate`            : drapeau de retard (alimente les pénalités)
 *
 * 2) `orders` — appel d'offres multi-agences (bloc A4) :
 *    - `dispatchOfferExpiresAt` : fin de la fenêtre courante (5 min)
 *    - `dispatchOfferRound`     : 0 aucun, 1 T+0, 2 re-diffusion T+5,
 *                                 3 clôture sans preneur T+10
 *
 * 3) `delivery_offers` — une ligne par (commande, agence) sollicitée.
 *    Contrainte d'unicité (orderId, agencyId) : la re-diffusion met à jour
 *    l'offre existante au lieu d'en créer une seconde.
 *
 * 4) `delivery_penalties` — échelle qualité à 3 crans (avertissement /
 *    baisse de priorité / suspension temporaire), historisée et réversible.
 *
 * Notes de conception (inchangées par rapport aux migrations récentes) :
 * - `gen_random_uuid()` (cœur PostgreSQL ≥ 13), PAS `uuid_generate_v4()`.
 * - PAS de FK : l'historique des offres et des sanctions doit survivre à la
 *   suppression d'une commande, d'une agence ou d'un compte.
 * - Advisory lock : deux instances Render qui bootent ensemble peuvent
 *   exécuter le même DDL (race sur pg_type). Libéré au COMMIT/ROLLBACK.
 * - `IF NOT EXISTS` partout : no-op idempotent, compatible avec le
 *   `synchronize` de développement.
 * - ROLLBACK : destructif (perte de la traçabilité du suivi de livraison et
 *   des sanctions), comme toutes les migrations de ce repo.
 */
export class AddDeliverySlaAndOffers1731000000000
  implements MigrationInterface
{
  name = 'AddDeliverySlaAndOffers1731000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sérialise les boots concurrents (libéré au commit/rollback).
    await queryRunner.query(
      `SELECT pg_advisory_xact_lock(hashtext('delivery_sla_offers_1731000000000'))`,
    );
    // No-op si déjà installé ; requis seulement sur PostgreSQL < 13.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ─── 1) Suivi SLA sur les commandes ─────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryEtaMinutes" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliverySlaDeadline" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryDurationMinutes" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryLate" boolean NOT NULL DEFAULT false`,
    );

    // ─── 2) Fenêtre d'appel d'offres sur les commandes ──────────────
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "dispatchOfferExpiresAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "dispatchOfferRound" integer NOT NULL DEFAULT 0`,
    );

    // Sert la supervision « courses en retard » (deliveryLate + fenêtre récente).
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_delivery_late"
       ON "orders" ("deliveryLate", "deliveredAt" DESC)`,
    );
    // Sert le cron d'appel d'offres (fenêtre ouverte, encore sans preneur).
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_dispatch_offer_expires"
       ON "orders" ("dispatchOfferExpiresAt")`,
    );

    // ─── 3) Table des offres d'appel d'offres ───────────────────────
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "delivery_offers" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "orderId" uuid NOT NULL,
      "agencyId" uuid NOT NULL,
      "status" varchar(16) NOT NULL DEFAULT 'PENDING',
      "commissionPct" numeric(5,2) NOT NULL DEFAULT 10,
      "agencyCommissionXof" numeric(12,2),
      "round" integer NOT NULL DEFAULT 1,
      "expiresAt" TIMESTAMP NOT NULL,
      "respondedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_delivery_offers_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_delivery_offers_order_agency" UNIQUE ("orderId", "agencyId")
    )`);

    // Sert « mes offres en attente » côté espace agence (agencyId + statut).
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_offers_agency_status"
       ON "delivery_offers" ("agencyId", "status")`,
    );
    // Sert la clôture des offres concurrentes après acceptation (orderId).
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_offers_order"
       ON "delivery_offers" ("orderId")`,
    );

    // ─── 4) Table des pénalités qualité ─────────────────────────────
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "delivery_penalties" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "targetType" varchar(16) NOT NULL,
      "driverId" uuid,
      "agencyId" uuid,
      "orderId" uuid,
      "level" varchar(24) NOT NULL,
      "reason" text,
      "effectiveFrom" TIMESTAMP NOT NULL DEFAULT now(),
      "effectiveUntil" TIMESTAMP,
      "active" boolean NOT NULL DEFAULT true,
      "createdBy" uuid,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_delivery_penalties_id" PRIMARY KEY ("id")
    )`);

    // Sert le scoring (livreurs sanctionnés) et l'espace livreur.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_penalties_driver_active"
       ON "delivery_penalties" ("driverId", "active")`,
    );
    // Sert le filtrage des agences suspendues + l'espace agence.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_penalties_agency_active"
       ON "delivery_penalties" ("agencyId", "active")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "delivery_penalties"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "delivery_offers"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_orders_dispatch_offer_expires"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_orders_delivery_late"`,
    );

    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "dispatchOfferRound"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "dispatchOfferExpiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "deliveryLate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "deliveryDurationMinutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "deliverySlaDeadline"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "deliveryEtaMinutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "deliveredAt"`,
    );
  }
}
