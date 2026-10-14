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

  @Column({ type: 'varchar', length: 200, nullable: true })
  sentBy: string | null;

  @Column({ type: 'int', default: 0 })
  recipientCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
