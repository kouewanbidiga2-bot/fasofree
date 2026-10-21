/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 📅 Statut de commande SCHEDULED (commandes à l'avance — bloc H).
 *
 * ⚠️ POURQUOI CETTE MIGRATION EXISTE :
 * la migration 1732000000000 a ajouté `orders.scheduledFor` et l'index
 * (`status`, `scheduledFor`)… mais PAS la valeur d'enum. Or `synchronize` est
 * INTERDIT en production (voir AGENTS.md §3.1) : le type Postgres
 * `orders_status_enum` ne contenait donc pas 'SCHEDULED'.
 *
 * Conséquence observée en production, toutes les minutes, sans fin :
 *   ERROR [Scheduler] QueryFailedError: invalid input value for enum
 *   orders_status_enum: "SCHEDULED"   (code PG 22P02)
 *   at OrdersService.releaseScheduledOrders
 *
 * On ne peut pas modifier 1732000000000 (déjà exécutée : elle ne sera jamais
 * rejouée), d'où cette nouvelle migration dédiée et idempotente.
 *
 * ⚠️ `ALTER TYPE … ADD VALUE` doit être exécuté seul : la nouvelle valeur
 * n'est utilisable qu'après le COMMIT de la transaction qui l'ajoute. Ici on ne
 * fait QUE l'ajouter (aucune requête ne s'en sert dans cette migration), donc
 * c'est sûr.
 *
 * Le bloc `DO … EXCEPTION WHEN undefined_object` reprend le motif déjà éprouvé
 * en production (migration 1723500000000) : si le type n'existe pas (dev /
 * tests sans enum Postgres), on ne casse pas le boot.
 */
export class AddScheduledOrderStatusEnum1734000000000
  implements MigrationInterface
{
  name = 'AddScheduledOrderStatusEnum1734000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sérialise deux instances Render qui booteraient en même temps.
    await queryRunner.query(
      `SELECT pg_advisory_xact_lock(hashtext('orders_status_scheduled_1734000000000'))`,
    );

    await queryRunner.query(`DO $$ BEGIN
      ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'SCHEDULED';
    EXCEPTION WHEN undefined_object THEN NULL; END $$;`);
  }

  public async down(): Promise<void> {
    // Non destructif : on ne retire JAMAIS une valeur d'un enum (des lignes
    // pourraient déjà l'utiliser). Comme toutes les migrations de ce repo.
  }
}
