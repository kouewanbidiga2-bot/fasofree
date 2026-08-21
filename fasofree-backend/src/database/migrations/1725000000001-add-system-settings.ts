import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSystemSettings1725000000001 implements MigrationInterface {
  name = 'AddSystemSettings1725000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "platformFee" int NOT NULL DEFAULT 100,
        "deliveryPricing" jsonb NOT NULL DEFAULT '${JSON.stringify({
          BICYCLE:    { baseFee: 250, ratePerKm: 100 },
          MOTORCYCLE: { baseFee: 400, ratePerKm: 150 },
          CAR:        { baseFee: 800, ratePerKm: 300 },
        })}',
        "fasoRidePricing" jsonb NOT NULL DEFAULT '${JSON.stringify({
          MOTORCYCLE: { minFare: 500, pricePerKm: 200 },
          ECONOMY:    { minFare: 500, pricePerKm: 200 },
          COMFORT:    { minFare: 700, pricePerKm: 280 },
          PREMIUM:    { minFare: 1000, pricePerKm: 400 },
        })}',
        "enableScheduling" boolean NOT NULL DEFAULT true,
        "enableBulkOrders" boolean NOT NULL DEFAULT true,
        "maxDeliveryRadius" int NOT NULL DEFAULT 15,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // Ajouter les colonnes véhicules aux users
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS "vehicleCategory" varchar(20) NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS "hasAirConditioning" boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "system_settings"`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS "vehicleCategory"`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS "hasAirConditioning"`);
  }
}
