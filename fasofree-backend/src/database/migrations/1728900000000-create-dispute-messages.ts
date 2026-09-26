import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 📝 Chat support des litiges : table des messages échangés entre le client,
 * le support et l'administration, rattachés à un litige (disputeId).
 * Permet au client de suivre sa réclamation en discutant directement
 * avec le support / super-admin / admin (visible par toute l'administration).
 *
 * Notes de conception :
 * - `gen_random_uuid()` (cœur PostgreSQL ≥ 13) et NON `uuid_generate_v4()`
 *   (extension uuid-ossp) : les migrations récentes du repo ont abandonné la
 *   dépendance à uuid-ossp. Évite un crash-loop de démarrage si l'extension
 *   manque (le DDL est transactionnel, mais le boot ne l'est pas).
 * - PAS de FK sur disputeId : cohérent avec `disputes` et
 *   `order_chat_messages`. L'historique de support doit survivre à la
 *   suppression d'une commande ; l'accès est validé côté service
 *   (addMessage → canAccess).
 * - `senderId varchar` : cohérent avec `order_chat_messages` ; évite la
 *   disparition de l'historique si un compte utilisateur est supprimé.
 * - Advisory lock : TypeORM ne sérialise pas les migrations ; deux instances
 *   Render qui bootent ensemble peuvent exécuter le même CREATE TABLE (race
 *   23505 sur pg_type). Le verrou est libéré au COMMIT/ROLLBACK.
 * - ROLLBACK : destructif (perte de l'historique de support), comme toutes
 *   les migrations de ce repo.
 */
export class CreateDisputeMessages1728900000000 implements MigrationInterface {
  name = 'CreateDisputeMessages1728900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sérialise les boots concurrents (libéré au commit/rollback).
    await queryRunner.query(
      `SELECT pg_advisory_xact_lock(hashtext('dispute_messages_1728900000000'))`,
    );
    // No-op si déjà installé ; requis seulement sur PostgreSQL < 13.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "dispute_messages" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "disputeId" uuid NOT NULL,
      "senderId" varchar NOT NULL,
      "senderRole" varchar(30) NOT NULL,
      "senderName" varchar(120),
      "message" text NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_dispute_messages_id" PRIMARY KEY ("id")
    )`);

    // WHERE disputeId = $1 ORDER BY createdAt [ASC|DESC] → Index Scan sans Sort.
    // La colonne "id" sert de tie-break pour une future pagination keyset.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dispute_messages_dispute_created"
       ON "dispute_messages" ("disputeId", "createdAt", "id")`,
    );

    // Sert listEligibleOrders (clientId + statuts livrés, ORDER BY createdAt
    // DESC LIMIT 30) : Index Scan ordonné au lieu de BitmapAnd + Sort.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_client_created"
       ON "orders" ("clientId", "createdAt" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "dispute_messages"`);
  }
}