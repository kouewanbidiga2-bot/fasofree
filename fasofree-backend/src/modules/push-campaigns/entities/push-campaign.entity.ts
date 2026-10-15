import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum PushCampaignTarget {
  ALL = 'ALL',
  CLIENT = 'CLIENT',
  DRIVER = 'DRIVER',
  MERCHANT = 'MERCHANT',
}

/**
 * ⏱️ Cycle de vie d'une campagne.
 *
 * SENT       : déjà diffusée (statut par défaut, rétro-compatible).
 * SCHEDULED  : programmée, sera diffusée par le cron automatique.
 */
export enum PushCampaignStatus {
  SCHEDULED = 'SCHEDULED',
  SENT = 'SENT',
}

/**
 * 📢 Campagne push promotionnelle.
 *
 * Super Admin + Admin peuvent envoyer une campagne à un public cible
 * par rôle. Les notifications sont envoyées via FCM (même si l'app est fermée).
 */
@Entity('push_campaigns')
export class PushCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 1000 })
  body: string;

  @Column({
    type: 'enum',
    enum: PushCampaignTarget,
    default: PushCampaignTarget.ALL,
  })
  target: PushCampaignTarget;

  @Column({
    type: 'enum',
    enum: PushCampaignStatus,
    default: PushCampaignStatus.SENT,
  })
  status: PushCampaignStatus;

  /** Date/heure de diffusion programmée (null = envoi immédiat). */
  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  sentBy: string | null;

  /** Nombre d'utilisateurs réellement contactés avec succès. */
  @Column({ type: 'int', default: 0 })
  recipientCount: number;

  /**
   * Nombre d'utilisateurs correspondant à la cible (avant envoi).
   * Permet de distinguer « personne ne corresponded » de « l'envoi a échoué ».
   */
  @Column({ type: 'int', default: 0 })
  targetedCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
