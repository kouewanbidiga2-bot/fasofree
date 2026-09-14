import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLoyaltyPointsTable1726100000002 implements MigrationInterface {
  name = 'CreateLoyaltyPointsTable1726100000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE loyalty_points_source_enum AS ENUM ('ORDER', 'REFERRAL', 'STREAK', 'BONUS', 'REDEMPTION');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS loyalty_points (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        userId UUID NOT NULL,
        points INT NOT NULL,
        source loyalty_points_source_enum DEFAULT 'ORDER' NOT NULL,
        orderId UUID,
        description VARCHAR(100),
        expiresAt TIMESTAMP,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_loyalty_points_user_source" ON "loyalty_points" ("userId", "source");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "loyalty_points";`);
  }
}
