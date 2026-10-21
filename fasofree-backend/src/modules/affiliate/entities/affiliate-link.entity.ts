/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 🔗 Lien court de suivi marchand.
 *
 * Un commerce possède un code unique (ex. FF-RESTO123) qui génère un lien
 * court `https://api.fasofree.site/r/CODE`. Le lien redirige vers la page
 * restaurant et enregistre un clic (attribution).
 */
@Entity('affiliate_links')
@Index(['code'], { unique: true })
export class AffiliateLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  // Code court unique, ex. "FF-RESTO123"
  @Column({ type: 'varchar', unique: true })
  code: string;

  @CreateDateColumn()
  createdAt: Date;
}
