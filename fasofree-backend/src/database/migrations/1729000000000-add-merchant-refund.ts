import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 📝 Remboursement décidé par le gérant du commerce (Phase 2).
 * Trace en base qui a remboursé (merchantRefundedBy), quand
 * (merchantRefundedAt) et la note du gérant (merchantNote) pour un litige
 * résolu directement par le marchand (décision seule, montant = total de la
 * commande).
 *
 * Notes de conception :
 * - Colonnes nullable : le flux admin (approveRefund/rejectDispute) ne les
 *   remplit pas ; seul le nouveau flux marchand (merchantRefund) les écrit.
 * - `merchantNote` est la voix du marchand : distincte d'`adminNote`
 *   (audit de l'administration) pour éviter toute usurpation de décision.
 * - `merchantRefundedBy` stocke l'id du compte gérant (pas de FK : cohérent
 *   avec `disputes` et `dispute_messages`, l'historique doit survivre à la
 *   suppression d'un compte).
 * - Advisory lock : TypeORM ne sérialise pas les migrations ; deux instances
 *   Render qui bootent ensemble peuvent exécuter le même ALTER TABLE (race).
 *   Le verrou est libéré au COMMIT/ROLLBACK.
 * - `ADD COLUMN IF NOT EXISTS` : no-op idempotent si déjà appliqué.
 * - ROLLBACK : destructif (perte de la traçabilité marchand), comme toutes
 *   les migrations de ce repo.
 */
export class AddMerchantRefund1729000000000 implements MigrationInterface {
  name = 'AddMerchantRefund1729000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sérialise les boots concurrents (libéré au commit/rollback).
    await queryRunner.query(
      `SELECT pg_advisory_xact_lock(hashtext('disputes_merchant_refund_1729000000000'))`,
    );
    // No-op si déjà installé ; requis seulement sur PostgreSQL < 13.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(
      `ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "merchantRefundedBy" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "merchantRefundedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "merchantNote" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP COLUMN IF EXISTS "merchantNote"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP COLUMN IF EXISTS "merchantRefundedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP COLUMN IF EXISTS "merchantRefundedBy"`,
    );
  }
}
