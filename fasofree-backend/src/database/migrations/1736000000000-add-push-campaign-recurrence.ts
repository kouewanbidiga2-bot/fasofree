/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🔁 Lot 2 — Campagnes push récurrentes.
 *
 * Ajoute à `push_campaigns` de quoi répéter une campagne dans le temps :
 *  - `recurrence`  : NONE (défaut) | DAILY | WEEKLY | MONTHLY
 *  - `timeOfDay`   : heure murale 'HH:MM' de diffusion
 *  - `daysOfWeek`  : jours 0-6 pour WEEKLY (jsonb)
 *  - `timeZone`    : fuseau d'interprétation (défaut Africa/Ouagadougou)
 *  - `nextRunAt`   : prochaine exécution, indexée — le cron lit
 *                    `status = 'ACTIVE' AND nextRunAt <= now`
 *  - `lastRunAt`   : dernière exécution réelle
 *  - `endsAt`      : borne de fin (au-delà → COMPLETED)
 *  - `runCount`    : nombre d'exécutions (diagnostic + facturation)
 *
 * Et étend l'enum `push_campaigns_status_enum` avec ACTIVE / COMPLETED.
 *
 * ⚠️ POURQUOI L'EXTENSION D'ENUM EST ICI ET PAS AILLEURS :
 * `synchronize` est INTERDIT en production (AGENTS.md §3.1) — un nouvel état
 * d'enum doit donc être ajouté EXPLICITEMENT, sinon toute écriture de statut
 * ACTIVE/COMPLETED échoue en 22P02 (« invalid input value for enum »).
 * C'est exactement le bug rencontré sur `orders_status_enum` (migration
 * 1734000000000). On réutilise ici le motif éprouvé :
 *  - `ADD VALUE IF NOT EXISTS` → idempotent ;
 *  - bloc `DO … EXCEPTION WHEN undefined_object` → no-op si le type n'existe
 *    pas (tests / bases sans enum Postgres) ;
 *  - `ALTER TYPE … ADD VALUE` n'est jamais suivi, dans cette migration, d'une
 *    requête qui UTILISE la nouvelle valeur (contrainte PostgreSQL).
 *
 * Toutes les colonnes sont nullables ou pourvues d'un défaut : les campagnes
 * existantes restent NONE et inchangées (rétro-compatibilité totale).
 */
export class AddPushCampaignRecurrence1736000000000
  implements MigrationInterface
{
  name = 'AddPushCampaignRecurrence1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sérialise deux instances Render qui booteraient en même temps.
    await queryRunner.query(
      `SELECT pg_advisory_xact_lock(hashtext('push_campaign_recurrence_1736000000000'))`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'push_campaigns_recurrence_enum') THEN
          CREATE TYPE "push_campaigns_recurrence_enum" AS ENUM('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');
        END IF;
      END $$;
    `);

    await queryRunner.query(`DO $$ BEGIN
      ALTER TYPE "push_campaigns_status_enum" ADD VALUE IF NOT EXISTS 'ACTIVE';
    EXCEPTION WHEN undefined_object THEN NULL; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      ALTER TYPE "push_campaigns_status_enum" ADD VALUE IF NOT EXISTS 'COMPLETED';
    EXCEPTION WHEN undefined_object THEN NULL; END $$;`);

    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "recurrence" "push_campaigns_recurrence_enum" NOT NULL DEFAULT 'NONE';
    `);

    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "timeOfDay" character varying(5);
    `);

    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "daysOfWeek" jsonb;
    `);

    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "timeZone" character varying(64) NOT NULL DEFAULT 'Africa/Ouagadougou';
    `);

    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "nextRunAt" TIMESTAMP WITH TIME ZONE;
    `);

    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "lastRunAt" TIMESTAMP WITH TIME ZONE;
    `);

    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP WITH TIME ZONE;
    `);

    await queryRunner.query(`
      ALTER TABLE "push_campaigns"
        ADD COLUMN IF NOT EXISTS "runCount" integer NOT NULL DEFAULT 0;
    `);

    // Le cron des récurrences cherche `status = ACTIVE AND nextRunAt <= now`.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_push_campaigns_status_nextRunAt" ON "push_campaigns" ("status", "nextRunAt");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_push_campaigns_status_nextRunAt";`,
    );
    // Ordre inverse de création.
    for (const column of [
      'runCount',
      'endsAt',
      'lastRunAt',
      'nextRunAt',
      'timeZone',
      'daysOfWeek',
      'timeOfDay',
      'recurrence',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "push_campaigns" DROP COLUMN IF EXISTS "${column}";`,
      );
    }
    await queryRunner.query(
      `DROP TYPE IF EXISTS "push_campaigns_recurrence_enum";`,
    );
    // Non destructif : on ne retire JAMAIS une valeur d'un enum de statut
    // (des lignes peuvent déjà l'utiliser), comme toutes les migrations du repo.
  }
}
