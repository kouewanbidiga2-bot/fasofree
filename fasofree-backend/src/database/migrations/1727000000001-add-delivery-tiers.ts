import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Ajout de la colonne deliveryTiers dans system_settings.
 *
 * Permet au Super Admin de configurer les tranches tarifaires de livraison
 * (paliers de distance avec prix fixe) depuis le dashboard admin.
 *
 * Remplace progressivement le système legacy (baseFee + ratePerKm).
 */
export class AddDeliveryTiers1727000000001 implements MigrationInterface {
  name = 'AddDeliveryTiers1727000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings"
      ADD COLUMN IF NOT EXISTS "deliveryTiers" JSONB DEFAULT '[
        {"minKm": 0, "maxKm": 15, "price": 1750, "label": "0-15 km"},
        {"minKm": 16, "maxKm": 20, "price": 2250, "label": "16-20 km"},
        {"minKm": 21, "maxKm": 25, "price": 2750, "label": "21-25 km"},
        {"minKm": 26, "maxKm": 30, "price": 3250, "label": "26-30 km"},
        {"minKm": 31, "maxKm": null, "price": 3750, "label": "31+ km"}
      ]'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "deliveryTiers";
    `);
  }
}
