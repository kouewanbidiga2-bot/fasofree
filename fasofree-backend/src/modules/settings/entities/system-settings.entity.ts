import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

export interface DeliveryVehiclePricing {
  baseFee: number;
  ratePerKm: number;
}

export interface FasoRideOptionPricing {
  minFare: number;
  pricePerKm: number;
}

/**
 * Configuration centralisée de la tarification FasoFree.
 * Ligne singleton (id=1) créée au démarrage si absente.
 */
@Entity('system_settings')
export class SystemSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', default: 100 })
  platformFee: number;

  @Column({
    type: 'jsonb',
    default: () => `'{ "BICYCLE": { "baseFee": 250, "ratePerKm": 100 }, "MOTORCYCLE": { "baseFee": 400, "ratePerKm": 150 }, "CAR": { "baseFee": 800, "ratePerKm": 300 } }'::jsonb`,
  })
  deliveryPricing: Record<string, DeliveryVehiclePricing>;

  @Column({
    type: 'jsonb',
    default: () => `'{ "MOTORCYCLE": { "minFare": 500, "pricePerKm": 200 }, "ECONOMY": { "minFare": 500, "pricePerKm": 200 }, "COMFORT": { "minFare": 700, "pricePerKm": 280 }, "PREMIUM": { "minFare": 1000, "pricePerKm": 400 } }'::jsonb`,
  })
  fasoRidePricing: Record<string, FasoRideOptionPricing>;

  @Column({ type: 'boolean', default: true })
  enableScheduling: boolean;

  @Column({ type: 'boolean', default: true })
  enableBulkOrders: boolean;

  @Column({ type: 'int', default: 15 })
  maxDeliveryRadius: number;

  @Column({ type: 'boolean', default: false })
  isPayoutFeeActive: boolean;

  @Column({ type: 'decimal', default: 1.5, precision: 5, scale: 2 })
  payoutFeePercentage: number;

  @Column({ type: 'int', default: 20000 })
  payoutFreeThreshold: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
