import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Garantit l'unicité de `merchant_payouts.orderId` au niveau de la base.
 * Un seul payout est possible par commande => prévient le double paiement
 * même en cas de retry / de plusieurs instances du cron d'escrow.
 * Idempotent : sans effet si l'index existe déjà (prod issue de synchronize).
 */
export class AddMerchantPayoutsOrderIdUniqueIndex1725200000000
  implements MigrationInterface
{
  name = 'AddMerchantPayoutsOrderIdUniqueIndex1725200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_merchant_payouts_orderId"
      ON "merchant_payouts" ("orderId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_merchant_payouts_orderId"
    `);
  }
}
