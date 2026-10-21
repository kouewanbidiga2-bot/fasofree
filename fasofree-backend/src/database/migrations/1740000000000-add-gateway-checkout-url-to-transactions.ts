/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🔧 Correctif 500 sur `POST /orders` en production.
 *
 * La colonne `gatewayCheckoutUrl` avait été ajoutée à l'entité `Transaction`
 * (commit 5363af7, « sécurité paiement ») SANS migration correspondante.
 * Résultat en prod (Neon, `synchronize` interdit, `migrationsRun` actif) :
 * la colonne n'existait pas dans la table, et TOUTE écriture/lecture TypeORM
 * sur `transactions` plantait (`column "gatewayCheckoutUrl" of relation
 * "transactions" does not exist`) :
 *  - `createOrder` → `save(transaction)` → rollback → 500 sur POST /orders
 *    (toast « Une erreur interne est survenue sur le serveur. ») ;
 *  - `initiatePayment` → `update({ gatewayCheckoutUrl })` → idem.
 * En dev, `synchronize` masquait le problème (colonne créée depuis l'entité).
 *
 * `IF NOT EXISTS` → compatible avec le `synchronize` de dev (AGENTS.md §3.1)
 * et rejouable sans erreur.
 */
export class AddGatewayCheckoutUrlToTransactions1740000000000
  implements MigrationInterface
{
  name = 'AddGatewayCheckoutUrlToTransactions1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD COLUMN IF NOT EXISTS "gatewayCheckoutUrl" varchar(255) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN IF EXISTS "gatewayCheckoutUrl";`,
    );
  }
}
