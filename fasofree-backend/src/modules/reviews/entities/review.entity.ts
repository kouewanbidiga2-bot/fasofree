import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum ReviewTargetType {
  DRIVER = 'DRIVER',
  COURIER = 'COURIER',
  BUSINESS = 'BUSINESS',
}

export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}

@Entity('reviews')
@Unique(['orderId', 'targetType'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  orderId: string;

  @Column({ type: 'varchar' })
  reviewerId: string; // The client who writes the review

  @Column({ type: 'varchar' })
  targetId: string; // The driver/courier/business being reviewed

  @Column({
    type: 'enum',
    enum: ReviewTargetType,
  })
  targetType: ReviewTargetType;

  @Column({ type: 'int' })
  score: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  tipAmount: number;

  @Column({ type: 'boolean', default: false })
  tipPaid: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
