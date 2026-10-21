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

export enum PushCampaignTarget {
  ALL = 'ALL',
  CLIENT = 'CLIENT',
  DRIVER = 'DRIVER',
  MERCHANT = 'MERCHANT',
}

/**
 * ⏱️ Cycle de vie d'une campagne.
 *
 * SENT       : déjà diffusée (statut par défaut, rétro-compatible).
 * SCHEDULED  : programmée une seule fois, sera diffusée par le cron.
 * ACTIVE     : campagne RÉCURRENTE en cours (voir `nextRunAt`).
 * COMPLETED  : campagne récurrente terminée (arrêtée ou `endsAt` dépassé).
 *
 * ⚠️ ACTIVE/COMPLETED sont ajoutés par la migration 1736000000000
 * (`ALTER TYPE … ADD VALUE`) : en production `synchronize` est interdit, l'enum
 * Postgres n'aurait donc jamais reçu ces valeurs autrement.
 */
export enum PushCampaignStatus {
  SCHEDULED = 'SCHEDULED',
  SENT = 'SENT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

/**
 * 🔁 Récurrence d'une campagne.
 *
 * NONE (défaut) = comportement historique : un seul envoi, immédiat ou
 * programmé. DAILY/WEEKLY/MONTHLY = la campagne se répète jusqu'à `endsAt`
 * (ou jusqu'à un arrêt manuel), le cron rafraîchissant `nextRunAt`.
 */
export enum PushCampaignRecurrence {
  NONE = 'NONE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

/**
 * 🕒 Fuseau par défaut des campagnes : Burkina Faso (UTC+0, sans heure d'été).
 * Défini ICI (et non dans le module de récurrence) pour que l'entité n'importe
 * jamais un module qui, lui, importe l'entité → pas d'import circulaire.
 */
export const DEFAULT_CAMPAIGN_TIMEZONE = 'Africa/Ouagadougou';

/**
 * 🎯 Audience d'une campagne AUTO-SERVICE (Lot 3).
 *
 * Depuis Lot 3, un marchand (BUSINESS_ADMIN) ou une société de livraison
 * (AGENCY) peut acheter une campagne push. Pour éviter le spam et protéger la
 * base clients, chacun est limité à SA propre audience :
 *  - OWN_CLIENTS : clients du compte — ceux ayant commandé chez ce marchand
 *                  (`orders.businessId`) ET/OU ceux livrés par cette agence
 *                  (`orders.deliveryProviderId`) ;
 *  - OWN_DRIVERS : livreurs rattachés à cette agence (`users.agencyId`) ;
 *  - ALL_CLIENTS : tous les clients de la plateforme (jamais livreurs/admin),
 *                  facturé au tarif « premium » de la grille super-admin.
 *
 * `ALL` (toute la base, tous rôles) reste réservé aux campagnes admin
 * (`audience` NULL) : c'est l'audience historique, non facturée.
 *
 * ⚠️ Colonne `varchar(40)` et NON un enum Postgres : en production
 * `synchronize` est interdit, un nouvel enum exigerait donc une migration
 * supplémentaire pour un simple libellé de traçabilité. La validation des
 * valeurs est faite en amont par `@IsEnum` (DTO) et `assertAudienceAllowed`.
 */
export enum PushCampaignAudience {
  ALL = 'ALL',
  ALL_CLIENTS = 'ALL_CLIENTS',
  OWN_CLIENTS = 'OWN_CLIENTS',
  OWN_DRIVERS = 'OWN_DRIVERS',
}

/**
 * 📢 Campagne push promotionnelle.
 *
 * Super Admin + Admin peuvent envoyer une campagne à un public cible
 * par rôle. Les notifications sont envoyées via FCM (même si l'app est fermée).
 *
 * Une campagne peut être unique (`recurrence = NONE`) ou récurrente
 * (DAILY/WEEKLY/MONTHLY), auquel cas le cron la rediffuse à chaque
 * `nextRunAt` jusqu'à `endsAt` ou un arrêt manuel.
 */
@Entity('push_campaigns')
@Index('IDX_push_campaigns_status_nextRunAt', ['status', 'nextRunAt'])
export class PushCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 1000 })
  body: string;

  @Column({
    type: 'enum',
    enum: PushCampaignTarget,
    default: PushCampaignTarget.ALL,
  })
  target: PushCampaignTarget;

  @Column({
    type: 'enum',
    enum: PushCampaignStatus,
    default: PushCampaignStatus.SENT,
  })
  status: PushCampaignStatus;

  /** Date/heure de diffusion programmée (null = envoi immédiat). */
  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  sentBy: string | null;

  /** Nombre d'utilisateurs réellement contactés avec succès. */
  @Column({ type: 'int', default: 0 })
  recipientCount: number;

  /**
   * Nombre d'utilisateurs correspondant à la cible (avant envoi).
   * Permet de distinguer « personne ne corresponded » de « l'envoi a échoué ».
   */
  @Column({ type: 'int', default: 0 })
  targetedCount: number;

  // ─── 🔁 RÉCURRENCE (Lot 2) ─────────────────────────────────────
  // Une campagne récurrente est rediffusée par le cron à chaque `nextRunAt`.
  // Une campagne `NONE` garde exactement le comportement historique
  // (un seul envoi, immédiat ou programmé).

  /** NONE (défaut) = un seul envoi. DAILY/WEEKLY/MONTHLY = répétition. */
  @Column({
    type: 'enum',
    enum: PushCampaignRecurrence,
    default: PushCampaignRecurrence.NONE,
  })
  recurrence: PushCampaignRecurrence;

  /** Heure murale 'HH:MM' de diffusion, dans `timeZone`. Null = heure de l'ancre. */
  @Column({ type: 'varchar', length: 5, nullable: true })
  timeOfDay: string | null;

  /** Jours de la semaine (0=dimanche … 6=samedi) pour WEEKLY. Null = jour de l'ancre. */
  @Column({ type: 'jsonb', nullable: true })
  daysOfWeek: number[] | null;

  /** Fuseau IANA d'interprétation de `timeOfDay`. Défaut Africa/Ouagadougou. */
  @Column({
    type: 'varchar',
    length: 64,
    default: DEFAULT_CAMPAIGN_TIMEZONE,
  })
  timeZone: string;

  /** Prochaine exécution (indexée) — le cron lit `status=ACTIVE AND nextRunAt<=now`. */
  @Column({ type: 'timestamptz', nullable: true })
  nextRunAt: Date | null;

  /** Date de la dernière exécution réelle. */
  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  /** Fin de récurrence : aucune exécution au-delà (→ COMPLETED). */
  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  /** Nombre d'exécutions réellement effectuées (facturation, diagnostic). */
  @Column({ type: 'int', default: 0 })
  runCount: number;

  // ─── 💳 AUTO-SERVICE ET FACTURATION (Lot 3) ─────────────────────
  // Une campagne créée par un marchand ou une agence est facturée
  // PUSH_CAMPAIGN_FEE à CHAQUE exécution (100 FCFA, jamais par destinataire).
  // `ownerUserId` NULL = campagne admin (gratuite, comportement historique).

  /** Compte payeur (BUSINESS_ADMIN ou agence). NULL = campagne admin gratuite. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  @Index('IDX_push_campaigns_ownerUserId')
  ownerUserId: string | null;

  /** Audience visée (voir `PushCampaignAudience`). NULL = cible par rôle. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  audience: PushCampaignAudience | null;

  /** Total réellement facturé (FCFA), cumulé sur toutes les exécutions. */
  @Column({ type: 'int', default: 0 })
  billedXof: number;

  /** Dernière transaction de portefeuille liée à la facturation. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  walletTransactionId: string | null;

  /**
   * Motif d'une suspension (typiquement « solde insuffisant » pour une
   * campagne récurrente). Permet à l'opérateur de comprendre pourquoi sa
   * campagne s'est arrêtée au lieu de la voir disparaître silencieusement.
   */
  @Column({ type: 'varchar', length: 300, nullable: true })
  failureReason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
