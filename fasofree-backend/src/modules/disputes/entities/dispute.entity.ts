import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DisputeStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED_REFUND = 'RESOLVED_REFUND',
  RESOLVED_REJECTED = 'RESOLVED_REJECTED',
  CLOSED = 'CLOSED',
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

  @Column({ type: 'text', nullable: true })
  adminNote: string | null;

  @Column({ type: 'enum', enum: DisputeResolution, nullable: true })
  resolution: DisputeResolution | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
