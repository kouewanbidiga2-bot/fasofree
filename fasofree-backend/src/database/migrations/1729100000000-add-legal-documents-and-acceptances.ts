import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ⚖️ Pack légal côté code : tables des documents légaux et des acceptations.
 *
 * Contexte : le Legal Pack (docs/legal/*.md) doit être servi depuis la base
 * de données — le Dockerfile de déploiement ne copie que `src/`, le filesystem
 * ne contient donc pas les documents en production.
 *
 * Notes de conception :
 * - `legal_documents` : source de vérité des textes (seedées depuis un module
 *   embarqué au boot). `docCode` est la PK (FR-CGU-001…) ; `version` est un
 *   string (le front-matter YAML utilise "1.0" — pas un numeric propre).
 * - `contract_acceptances` : preuve d'acceptation horodatée, alignée sur le
 *   protocole du README du pack (§5) : accountId / docCode / docVersion /
 *   acceptedAt / mechanism / source / ipOrDeviceId.
 *   - `userId` FK → users ON DELETE CASCADE (l'historique suit le compte).
 *   - Index unique (userId, docCode, docVersion) : stoppe le double
 *     enregistrement de la MÊME version. Une nouvelle version du document
 *     crée une nouvelle ligne (preuve de la version acceptée).
 *   - Pas de FK vers legal_documents sur docCode : l'historique d'acceptation
 *     doit survivre même si un document est retiré/renommé.
 * - Advisory lock : deux instances Render peuvent exécuter le même DDL en
 *   parallèle ; le verrou, libéré au COMMIT/ROLLBACK, sérialise la migration.
 *   NB : le seed des documents (LegalService.onModuleInit) s'exécute APRÈS les
 *   migrations et n'est PAS couvert par ce verrou — il est idempotent par
 *   nature (upsert par PK), aucune correction nécessaire.
 * - `gen_random_uuid()` (cœur PostgreSQL ≥ 13) — pas d'extension uuid-ossp
 *   (dépendance abandonnée par les migrations récentes de ce repo).
 * - ROLLBACK : destructif (perte de la traçabilité des acceptations), comme
 *   toutes les migrations de ce repo.
 */
export class AddLegalDocumentsAndAcceptances1729100000000
  implements MigrationInterface
{
  name = 'AddLegalDocumentsAndAcceptances1729100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sérialise les boots concurrents (libéré au commit/rollback).
    await queryRunner.query(
      `SELECT pg_advisory_xact_lock(hashtext('legal_documents_1729100000000'))`,
    );

    // ────────────────────────────────────────────────────────────────────────
    // 1. Documents légaux (textes servis aux utilisateurs)
    // ────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "legal_documents" (
        "docCode" varchar(20) NOT NULL,
        "title" varchar(255) NOT NULL,
        "version" varchar(20) NOT NULL,
        "statut" varchar(50) NOT NULL DEFAULT 'brouillon',
        "date" varchar(30) NULL,
        "mecanisme" varchar(50) NOT NULL DEFAULT 'case-a-cocher',
        "audience" varchar(40) NOT NULL DEFAULT 'tous',
        "contentMd" text NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_legal_documents_docCode" PRIMARY KEY ("docCode")
      );
    `);

    // ────────────────────────────────────────────────────────────────────────
    // 2. Acceptations de documents (preuve horodatée, protocole README §5)
    // ────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contract_acceptances" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "docCode" varchar(20) NOT NULL,
        "docVersion" varchar(20) NOT NULL,
        "mechanism" varchar(30) NOT NULL DEFAULT 'case-a-cocher',
        "source" varchar(30) NULL,
        "ip" varchar(45) NULL,
        "acceptedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contract_acceptances_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_contract_acceptances_user_doc_version" UNIQUE ("userId", "docCode", "docVersion"),
        CONSTRAINT "FK_contract_acceptances_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    // Accès rapide à l'historique d'un compte (GET /legal/acceptances/me).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contract_acceptances_userId"
        ON "contract_acceptances" ("userId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "contract_acceptances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "legal_documents"`);
  }
}