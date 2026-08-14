import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DisputeStatus {
  OPEN = 'OPEN', // Litige créé par le client
  UNDER_INVESTIGATION = 'UNDER_INVESTIGATION', // Pris en charge par agent support
  PENDING_ADMIN_APPROVAL = 'PENDING_ADMIN_APPROVAL', // Recommandation support, en attente admin
  APPROVED = 'APPROVED', // Validé par admin (déclenche remboursement)
  REJECTED = 'REJECTED', // Rejeté par admin ou support
  CLOSED = 'CLOSED', // Clôturé (autre raison)
}

export enum DisputeResolution {
  REFUND = 'REFUND',
  REJECT = 'REJECT',
}

@Entity('disputes')
@Index(['orderId'], { unique: true })
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @Index()
  @Column({ type: 'uuid' })
  clientId: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  attachments: string[];

  @Column({ type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
  status: DisputeStatus;

  @Column({ type: 'uuid', nullable: true })
  assignedAdminId: string | null;

  @Column({ type: 'uuid', nullable: true })
  supportAgentId: string | null;

  @Column({ type: 'text', nullable: true })
  supportNote: string | null;

  @Column({ type: 'text', nullable: true })
  adminNote: string | null;

  @Column({ type: 'enum', enum: DisputeResolution, nullable: true })
  resolution: DisputeResolution | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  refundAmount: number | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
