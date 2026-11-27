import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGuestDeliveryCheckout1743000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "orders" ALTER COLUMN "clientId" DROP NOT NULL');
    await queryRunner.query('ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "guestCheckoutKeyHash" varchar(64)');
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_orders_guestCheckoutKeyHash" ON "orders" ("guestCheckoutKeyHash")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [guestOrder] = await queryRunner.query('SELECT 1 FROM "orders" WHERE "clientId" IS NULL LIMIT 1');
    if (guestOrder) throw new Error('Des commandes invitées nécessitent un clientId nullable.');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_orders_guestCheckoutKeyHash"');
    await queryRunner.query('ALTER TABLE "orders" DROP COLUMN IF EXISTS "guestCheckoutKeyHash", ALTER COLUMN "clientId" SET NOT NULL');
  }
}
