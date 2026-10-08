import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 💰 Stories payantes :
 * - Ajoute le motif de débit STORY_FEE (50 FCFA par story à l'unité).
 * L'abonnement mensuel (Pass Stories 5 000 FCFA) réutilise le motif
 * SUBSCRIPTION_FEE déjà existant — aucun autre changement de schéma requis.
 */
export class AddStoryFee1725900000000 implements MigrationInterface {
  name = 'AddStoryFee1725900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(
        `ALTER TYPE "wallet_transactions_reason_enum" ADD VALUE IF NOT EXISTS 'STORY_FEE'`,
      );
    } catch {
      // Certains environnements (dev, SQLite en test) n'ont pas d'enum PG :
      // l'échec est non bloquant si le type n'existe pas.
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Non destructif : on n'ajoute jamais de valeur dans un enum en down().
  }
}