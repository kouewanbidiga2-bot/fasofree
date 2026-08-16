import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionSubjectType } from './subscription.entity';

export const PLAN_CODE_STARTER = 'STARTER';
export const PLAN_CODE_PRO = 'PRO';
export const PLAN_CODE_VIP = 'VIP';

/**
 * 📦 Catalogue de forfaits FasoFree (géré par le Super Admin).
 * - STARTER  : gratuit, commission standard 5% (commerce)
 * - PRO      : 5 000 FCFA/mois, commission préférentielle 1.5% (commerce)
 * - VIP      : 2 500 FCFA/mois, livraison + frais de service offerts (client)
 *
 * Les tarifs/commissions sont pilotables par le Super Admin via
 * les endpoints /subscriptions/plans.
 */
@Entity('subscription_plans')
export class SubscriptionPlanEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: SubscriptionSubjectType })
  subjectType: SubscriptionSubjectType;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  priceFcfa: number;

  @Column({ type: 'int', default: 30 })
  durationDays: number;

  // Taux de commission préférentiel marchand (0.015 = 1.5%).
  // null → taux standard (Starter 5%).
  @Column({
    type: 'decimal',
    precision: 6,
    scale: 4,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : parseFloat(value)),
    },
  })
  commissionRate: number | null;

  // 🎁 Avantages clients (VIP) : frais de plateforme offerts
  @Column({ type: 'boolean', default: false })
  freeServiceFee: boolean;

  // 🚚 Avantages clients (VIP) : livraison gratuite
  @Column({ type: 'boolean', default: false })
  freeDelivery: boolean;

  // Seuil de panier minimum pour bénéficier de la livraison gratuite (0 = aucune condition)
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  freeDeliveryMinSubtotal: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
