/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Table des demandes de recharge de portefeuille (SasPay).
 * SasPay ne renvoie pas la référence Koliwa dans son webhook : on retrouve
 * la recharge par `providerPaymentId`. `IF NOT EXISTS` : rejouable et compatible
 * avec le `synchronize` de dev (AGENTS.md §3.1).
 */
export class CreateTopupRequests1741000000000 implements MigrationInterface {
  name = 'CreateTopupRequests1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "topup_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reference" varchar(100) NOT NULL,
        "providerPaymentId" varchar(100) NULL,
        "userId" varchar(64) NOT NULL,
        "walletRole" varchar(20) NOT NULL,
        "branchId" varchar(64) NULL,
        "amount" numeric(12,2) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_topup_requests_id" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_topup_requests_reference"
        ON "topup_requests" ("reference");
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_topup_requests_providerPaymentId"
        ON "topup_requests" ("providerPaymentId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "topup_requests";`);
  }
}
