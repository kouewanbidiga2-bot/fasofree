import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 🧾 Journal d'audit des actions d'administration.
 *
 * Remplit le manque critique : l'app permet des actions sensibles
 * (suppression définitive d'un compte/commerce, remboursement manuel,
 * changement de tarif, validation KYC, résolution de litige…) sans
 * conserver la moindre trace de QUI a fait QUOI et QUAND.
 *
 * - Écriture seule : jamais mis à jour ni supprimé par l'application.
 * - `payload` est expurgé des secrets (mots de passe, tokens) avant stockage.
 */
@Entity('audit_logs')
@Index(['createdAt'])
@Index(['action'])
@Index(['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 👤 Opérateur à l'origine de l'action (null = action automatique/système)
  @Column({ type: 'uuid', nullable: true })
  @Index()
  actorId: string | null;

  @Column({ type: 'varchar', nullable: true })
  actorEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  actorRole: string | null;

  // 🎯 Action métier, ex. 'user.delete', 'settings.update', 'dispute.resolve'
  @Column({ type: 'varchar' })
  action: string;

  // 📦 Entité concernée, ex. 'USER', 'BUSINESS', 'DISPUTE', 'SYSTEM_SETTINGS'
  @Column({ type: 'varchar', nullable: true })
  entityType: string | null;

  @Column({ type: 'varchar', nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', nullable: true })
  httpMethod: string | null;

  @Column({ type: 'varchar', nullable: true })
  path: string | null;

  @Column({ type: 'varchar', nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string | null;

  // 📦 Contexte de l'appel (body + query + params), expurgé des secrets
  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ type: 'varchar', default: 'SUCCESS' })
  result: string;

  @Column({ type: 'int', nullable: true })
  statusCode: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
