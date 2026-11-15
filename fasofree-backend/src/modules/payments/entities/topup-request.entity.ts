/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum TopupStatus {
  PENDING = 'PENDING',
  CREDITED = 'CREDITED',
  FAILED = 'FAILED',
}

/**
 * Une demande de recharge de portefeuille. SasPay ne renvoie pas notre
 * référence dans son webhook : la correspondance se fait par `providerPaymentId`
 * (id du paiement SasPay), et le crédit est appliqué une seule fois
 * (passage PENDING → CREDITED conditionnel).
 */
@Entity('topup_requests')
export class TopupRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  reference: string;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  providerPaymentId: string | null;

  @Column({ type: 'varchar', length: 64 })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  walletRole: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  branchId: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 16, default: TopupStatus.PENDING })
  status: TopupStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
