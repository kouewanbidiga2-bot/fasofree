/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🕐📅 Lot 3 (bloc H) — Horaires d'ouverture + commandes à l'avance.
 *
 * 1) `businesses.openingHours` (jsonb) : horaires récurrents hebdomadaires
 *    pilotés par le marchand. `null` = non renseigné → `isOpen` décide seul,
 *    ce qui préserve exactement le comportement antérieur.
 *
 * 2) `businesses.advanceOrderConfig` (jsonb) : le commerce choisit s'il
 *    accepte les commandes à l'avance, avec un délai min (heures) et max
 *    (jours). `null` = fonctionnalité non configurée → refusée.
 *
 * 3) `orders.scheduledFor` (timestamp) : livraison souhaitée. Présent +
 *    statut SCHEDULED = commande payée attendant sa libération par le cron
 *    `releaseScheduledOrders`.
 *
 * Notes de conception (identiques aux migrations précédentes) :
 * - `IF NOT EXISTS` partout : no-op idempotent, compatible avec le
 *   `synchronize` de développement.
 * - Advisory lock : deux instances Render qui bootent ensemble peuvent
 *   exécuter le même DDL.
 * - jsonb (et non 14 colonnes) : les horaires sont une donnée marchand,
 *   partiellement renseignée par nature (jour fermé, horaires week-end).
 * - ROLLBACK : destructif, comme toutes les migrations de ce repo.
 */
export class AddOpeningHoursAndAdvanceOrders1732000000000
  implements MigrationInterface
{
  name = 'AddOpeningHoursAndAdvanceOrders1732000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sérialise les boots concurrents (libéré au commit/rollback).
    await queryRunner.query(
      `SELECT pg_advisory_xact_lock(hashtext('opening_hours_advance_1732000000000'))`,
    );
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ─── 1) Horaires d'ouverture du commerce ──────────────────────
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "openingHours" jsonb`,
    );

    // ─── 2) Configuration des commandes à l'avance ────────────────
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "advanceOrderConfig" jsonb`,
    );

    // ─── 3) Livraison souhaitée sur les commandes ─────────────────
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP`,
    );

    // Sert le cron de libération : commandes SCHEDULED dont l'heure est venue.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_scheduled_for"
       ON "orders" ("status", "scheduledFor")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_orders_scheduled_for"`,
    );

    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "scheduledFor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "advanceOrderConfig"`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "openingHours"`,
    );
  }
}
