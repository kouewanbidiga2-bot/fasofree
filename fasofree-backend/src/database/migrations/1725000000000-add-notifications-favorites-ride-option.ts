import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationsFavoritesRideOption1725000000000 implements MigrationInterface {
  name = 'AddNotificationsFavoritesRideOption1725000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Notifications table ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "type" VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
        "title" VARCHAR(200) NOT NULL,
        "body" TEXT NOT NULL,
        "orderId" VARCHAR,
        "actionUrl" VARCHAR,
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "IDX_notifications_user_read" ON "notifications" ("userId", "isRead");
      CREATE INDEX IF NOT EXISTS "IDX_notifications_user_id" ON "notifications" ("userId");
    `);

    // --- Favorites table ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "favorites" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "businessId" UUID NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_favorites_user_business" UNIQUE ("userId", "businessId")
      );
      CREATE INDEX IF NOT EXISTS "IDX_favorites_user_id" ON "favorites" ("userId");
    `);

    // --- Ride option on orders ---
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "orders" ADD COLUMN "rideOption" VARCHAR(20);
      EXCEPTION WHEN duplicate_column THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "favorites"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "rideOption"`);
  }
}
