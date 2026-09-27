import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * ⚖️ Document légal servi aux utilisateurs (CGU, confidentialité, contrat
 * marchand / livreur…). Source de vérité : la table est seedée depuis
 * `LEGAL_DOCUMENTS_SEED` (contenu embarqué généré depuis docs/legal/*.md).
 *
 * `statut`, `mecanisme` et `audience` proviennent du front-matter YAML des
 * documents source (ex. "a-relire-avocat", "signature-otp", "commercant").
 */
@Entity('legal_documents')
export class LegalDocument {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  docCode: string; // FR-CGU-001, FR-PRIV-002, FR-PMERC-005, FR-LIVR-006…

  @Column({ type: 'varchar', length: 255 })
  title: string;

  /** Version du document ("1.0", "0.9"…) — provenant du front-matter. */
  @Column({ type: 'varchar', length: 20 })
  version: string;

  /** Statut éditorial : a-relire-avocat / brouillon-avocat / publie… */
  @Column({ type: 'varchar', length: 50, default: 'brouillon' })
  statut: string;

  /** Date d'entrée en vigueur (provenant du front-matter). */
  @Column({ type: 'varchar', length: 30, nullable: true })
  date: string | null;

  /** Mécanisme d'acceptation : case-a-cocher / signature-otp / renvoi… */
  @Column({ type: 'varchar', length: 50, default: 'case-a-cocher' })
  mecanisme: string;

  /** Audience : client / commercant / livreur / tous / interne-cil… */
  @Column({ type: 'varchar', length: 40, default: 'tous' })
  audience: string;

  /** Contenu Markdown complet du document. */
  @Column({ type: 'text' })
  contentMd: string;

  @Column({ type: 'timestamp', default: () => 'now()' })
  updatedAt: Date;
}