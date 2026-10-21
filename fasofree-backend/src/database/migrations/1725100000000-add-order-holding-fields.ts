/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderHoldingFields1725100000000 implements MigrationInterface {
  name = 'AddOrderHoldingFields1725100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "payoutScheduledAt" TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS "payoutReleased" BOOLEAN NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "payoutReleased",
        DROP COLUMN IF EXISTS "payoutScheduledAt"
    `);
  }
}
