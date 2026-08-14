import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Mise à jour de la machine à états des litiges (validation à 2 niveaux)
 *
 * Champs ajoutés:
 * - supportAgentId: UUID (ID de l'agent support)
 * - supportNote: TEXT (note de l'agent support)
 * - refundAmount: DECIMAL (montant du remboursement recommandé)
 *
 * Modification des types:
 * - DisputeStatus enum: Ajout de UNDER_INVESTIGATION, PENDING_ADMIN_APPROVAL, APPROVED
 */
export class UpdateDisputeStatusEnum1724300000000 implements MigrationInterface {
  name = 'UpdateDisputeStatusEnum1724300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ajouter les nouveaux champs
    await queryRunner.query(`
      ALTER TABLE "disputes"
      ADD COLUMN "supportAgentId" UUID,
      ADD COLUMN "supportNote" TEXT,
      ADD COLUMN "refundAmount" DECIMAL(10, 2);
    `);

    // Créer un index sur supportAgentId
    await queryRunner.query(`
      CREATE INDEX "idx_disputes_supportAgentId" ON "disputes"("supportAgentId");
    `);

    // Mettre à jour l'enum DisputeStatus
    // Note: PostgreSQL nécessite de supprimer et recréer l'enum pour le modifier
    await queryRunner.query(`
      ALTER TABLE "disputes"
      ALTER COLUMN "status" TYPE VARCHAR(50);
    `);

    // Mettre à jour les valeurs existantes pour le nouvel enum
    await queryRunner.query(`
      UPDATE "disputes" SET "status" = 'UNDER_INVESTIGATION' WHERE "status" = 'UNDER_REVIEW';
      UPDATE "disputes" SET "status" = 'APPROVED' WHERE "status" = 'RESOLVED_REFUND';
      UPDATE "disputes" SET "status" = 'REJECTED' WHERE "status" = 'RESOLVED_REJECTED';
    `);

    // Re-créer la contrainte check avec le nouvel enum
    await queryRunner.query(`
      ALTER TABLE "disputes"
      ADD CONSTRAINT "CK_disputes_status" 
      CHECK ("status" IN ('OPEN', 'UNDER_INVESTIGATION', 'PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED', 'CLOSED'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Supprimer la contrainte check
    await queryRunner.query(`
      ALTER TABLE "disputes" DROP CONSTRAINT IF EXISTS "CK_disputes_status";
    `);

    // Revenir aux anciennes valeurs
    await queryRunner.query(`
      UPDATE "disputes" SET "status" = 'UNDER_REVIEW' WHERE "status" = 'UNDER_INVESTIGATION';
      UPDATE "disputes" SET "status" = 'RESOLVED_REFUND' WHERE "status" = 'APPROVED';
      UPDATE "disputes" SET "status" = 'RESOLVED_REJECTED' WHERE "status" = 'REJECTED';
    `);

    // Remettre en VARCHAR (pour rollback)
    await queryRunner.query(`
      ALTER TABLE "disputes" ALTER COLUMN "status" TYPE VARCHAR(50);
    `);

    // Supprimer l'index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_disputes_supportAgentId";`,
    );

    // Supprimer les nouveaux champs
    await queryRunner.query(`
      ALTER TABLE "disputes"
      DROP COLUMN "refundAmount",
      DROP COLUMN "supportNote",
      DROP COLUMN "supportAgentId";
    `);
  }
}
