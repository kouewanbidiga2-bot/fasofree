import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PromotionKind {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  code: string;
  @Column({ type: 'enum', enum: PromotionKind }) kind: PromotionKind;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) value: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  minimumOrderAmount: number;
  @Column({ type: 'int', nullable: true }) usageLimit: number | null;
  @Column({ type: 'int', default: 0 }) usageCount: number;
  @Column({ type: 'timestamp' }) startsAt: Date;
  @Column({ type: 'timestamp' }) endsAt: Date;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
