import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crée la table `payout_requests` (demandes de retrait en file d'attente).
 *
 * L'entité PayoutRequest existait côté code mais la table n'a jamais été créée
 * par migration : le monitoring financier et le cron de payout plantaient
 * donc silencieusement sur cette table.
 */
export class CreatePayoutRequests1725900000000 implements MigrationInterface {
  name = '1725900000000-create-payout-requests';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payout_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" varchar NOT NULL,
        "userRole" varchar NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "phoneNumber" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "transactionReference" varchar,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payout_requests" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payout_requests"`);
  }
}
