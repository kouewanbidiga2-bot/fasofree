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

  @CreateDateColumn()
  createdAt: Date;
}
