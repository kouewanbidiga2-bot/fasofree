import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { User } from '../../users/entities/user.entity';

export enum StoryMediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

@Entity('stories')
@Index(['businessId', 'expiresAt'])
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column({ type: 'uuid', nullable: true })
  createdById: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'varchar', length: 500 })
  mediaUrl: string;

  @Column({ type: 'varchar', length: 20, default: StoryMediaType.IMAGE })
  mediaType: StoryMediaType;

  @Column({ type: 'varchar', length: 280, nullable: true })
  caption: string;

  @Column({ type: 'int', default: 0 })
  viewsCount: number;

  @Column({ type: 'int', default: 0 })
  likesCount: number;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
