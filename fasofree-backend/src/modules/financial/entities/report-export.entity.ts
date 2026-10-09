import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 📄 Export périodique (CSV) conservé en base.
 *
 * Le fichier est stocké en base plutôt que sur disque/Cloudinary :
 * - aucun secret externe à configurer,
 * - historique conservé et téléchargeable depuis le Super Admin,
 * - la génération et l'archivage restent atomiques.
 *
 * Volume : une fenêtre de 5 jours tient largement dans le TEXT (plafond de lignes
 * appliqué côté service, cf. REPORT_MAX_ROWS).
 */
@Entity('report_exports')
@Index(['kind', 'createdAt'])
export class ReportExport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', default: 'TRANSACTIONS_CSV' })
  kind: string;

  @Column({ type: 'timestamp' })
  periodStart: Date;

  @Column({ type: 'timestamp' })
  periodEnd: Date;

  @Column({ type: 'varchar' })
  fileName: string;

  @Column({ type: 'int', default: 0 })
  rowCount: number;

  @Column({ type: 'boolean', default: false })
  truncated: boolean;

  @Column({ type: 'text' })
  csvContent: string;

  /** Totaux de contrôle : réconciliation entrées/sorties, par motif et par moyen. */
  @Column({ type: 'jsonb', nullable: true })
  summary: Record<string, unknown> | null;

  @Column({ type: 'varchar', default: 'CRON' })
  generatedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  downloadedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  downloadCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
