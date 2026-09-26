import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 💬 Message du chat support rattaché à un litige.
 *
 * Le chat d'un litige est ouvert :
 * - au client propriétaire de la réclamation,
 * - au support / admin / super admin (toute l'administration),
 * - au gérant du commerce concerné (pour régler à l'amiable).
 */
@Entity('dispute_messages')
@Index(['disputeId', 'createdAt', 'id'])
export class DisputeMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  disputeId: string;

  @Column({ type: 'varchar' })
  senderId: string;

  @Column({ type: 'varchar', length: 30 })
  senderRole: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  senderName: string | null;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn()
  createdAt: Date;
}
