import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsOrder,
  FindOptionsWhere,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import {
  PushCampaign,
  PushCampaignRecurrence,
  PushCampaignStatus,
  PushCampaignTarget,
  DEFAULT_CAMPAIGN_TIMEZONE,
} from './entities/push-campaign.entity';
import {
  computeNextRunAt,
  RecurrenceSpec,
} from './push-campaign-recurrence';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { NotificationStoreService } from '../notifications/notification-store.service';
import { NotificationType } from '../notifications/entities/notification.entity';

/**
 * 🔁 Options de récurrence passées à `createCampaign`.
 * Objet (et non paramètres positionnels) pour ne pas casser les appels
 * existants `createCampaign(title, body, target, sentBy, scheduledAt)`.
 */
export interface CreatePushCampaignOptions {
  recurrence?: PushCampaignRecurrence | null;
  timeOfDay?: string | null;
  daysOfWeek?: number[] | null;
  timeZone?: string | null;
  endsAt?: Date | null;
}

@Injectable()
export class PushCampaignService {
  private readonly logger = new Logger(PushCampaignService.name);
  private readonly BATCH_SIZE = 200;
  /** Garde-fou mémoire : jamais plus de 50 000 destinataires par campagne. */
  private readonly MAX_RECIPIENTS = 50_000;
  /** Nombre de campagnes échues traitées par tick de cron (borne la charge). */
  private readonly MAX_DUE_PER_TICK = 20;

  constructor(
    @InjectRepository(PushCampaign)
    private readonly campaignRepo: Repository<PushCampaign>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationStore: NotificationStoreService,
  ) {}

  /**
   * Rôles correspondant à chaque cible.
   * ⚠️ `RIDER` et `MERCHANT` n'existent PAS dans `UserRole` : lesMapped ici
   * sur les libellés réels du domaine (COURIER pour les livreurs,
   * BUSINESS_ADMIN pour les commerçants). Une cible sans rôle mappé
   * sélectionnerait 0 destinataire.
   */
  private getRoleFilter(target: PushCampaignTarget): UserRole[] | null {
    switch (target) {
      case PushCampaignTarget.CLIENT:
        return [UserRole.CLIENT];
      case PushCampaignTarget.DRIVER:
        return [UserRole.COURIER, UserRole.DRIVER];
      case PushCampaignTarget.MERCHANT:
        return [UserRole.BUSINESS_ADMIN];
      case PushCampaignTarget.ALL:
      default:
        return null;
    }
  }

  async createCampaign(
    title: string,
    body: string,
    target: PushCampaignTarget,
    sentBy?: string | null,
    scheduledAt?: Date | null,
    options?: CreatePushCampaignOptions,
  ): Promise<PushCampaign> {
    const recurrence = options?.recurrence ?? PushCampaignRecurrence.NONE;
    const timeZone = (options?.timeZone || '').trim() || DEFAULT_CAMPAIGN_TIMEZONE;
    const timeOfDay = options?.timeOfDay?.trim() || null;
    const rawDays = options?.daysOfWeek;
    const daysOfWeek =
      Array.isArray(rawDays) && rawDays.length > 0
        ? rawDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : null;
    const endsAt =
      options?.endsAt instanceof Date && !Number.isNaN(options.endsAt.getTime())
        ? options.endsAt
        : null;

    // ─── 🔁 Campagne RÉCURRENTE ────────────────────────────────────
    // La 1ʳᵉ exécution est PLANIFIÉE (jamais immédiate) : chaque exécution
    // passe ainsi par le même chemin (facturation par run, Lot 3) et l'admin
    // sait exactement quand part la première diffusion.
    if (recurrence !== PushCampaignRecurrence.NONE) {
      const validScheduled =
        scheduledAt instanceof Date && !Number.isNaN(scheduledAt.getTime())
          ? scheduledAt
          : null;
      const anchor = validScheduled ?? new Date();
      const spec: RecurrenceSpec = {
        recurrence,
        anchor,
        timeOfDay,
        daysOfWeek,
        timeZone,
        endsAt,
      };
      const firstRunAt = computeNextRunAt(spec, new Date());

      const campaign = await this.campaignRepo.save(
        this.campaignRepo.create({
          title,
          body,
          target,
          sentBy: sentBy || null,
          status: firstRunAt
            ? PushCampaignStatus.ACTIVE
            : PushCampaignStatus.COMPLETED,
          // `scheduledAt` garde la 1ʳᵉ échéance (affichage), `nextRunAt` pilote
          // le cron — les deux coïncident au départ.
          scheduledAt: firstRunAt,
          recurrence,
          timeOfDay,
          daysOfWeek,
          timeZone,
          nextRunAt: firstRunAt,
          lastRunAt: null,
          endsAt,
          runCount: 0,
          recipientCount: 0,
          targetedCount: 0,
        }),
      );

      if (!firstRunAt) {
        this.logger.warn(
          `[PushCampaign] ${campaign.id} récurrente (${recurrence}) sans prochaine occurrence — endsAt déjà dépassé ? → COMPLETED`,
        );
      } else {
        this.logger.log(
          `[PushCampaign] ${campaign.id} récurrente (${recurrence}${timeOfDay ? ` à ${timeOfDay}` : ''} ${timeZone}) — 1ʳᵉ diffusion le ${firstRunAt.toISOString()}`,
        );
      }
      return campaign;
    }

    // ⏱️ Programmation : une date dans le futur diffuse plus maintenant.
    const isScheduled =
      scheduledAt instanceof Date &&
      !Number.isNaN(scheduledAt.getTime()) &&
      scheduledAt.getTime() > Date.now();

    const campaign = await this.campaignRepo.save(
      this.campaignRepo.create({
        title,
        body,
        target,
        sentBy: sentBy || null,
        status: isScheduled ? PushCampaignStatus.SCHEDULED : PushCampaignStatus.SENT,
        scheduledAt: isScheduled ? scheduledAt : null,
        recipientCount: 0,
        targetedCount: 0,
      }),
    );

    if (isScheduled) {
      this.logger.log(
        `[PushCampaign] ${campaign.id} programmée pour ${scheduledAt?.toISOString()} (cible=${target})`,
      );
      return campaign;
    }

    // ⚠️ L'envoi part en arrière-plan : on ne bloque PAS la réponse HTTP sur
    // N envois. On journalise les erreurs pour ne jamais laisser un rejet non
    // capté tuer le process.
    void this.sendCampaign(campaign.id, title, body, target).catch((err) => {
      this.logger.error(
        `[PushCampaign] Échec envoi async: ${(err as Error).message}`,
      );
    });

    return campaign;
  }

  /**
   * ⏱️ Cron : diffuse les campagnes échues.
   *
   * Deux populations :
   *  1. `SCHEDULED` (envoi unique) dont `scheduledAt` est atteint → SENT ;
   *  2. `ACTIVE` (récurrente) dont `nextRunAt` est atteint → on rediffuse puis
   *     on recalcule `nextRunAt` (→ COMPLETED si `endsAt` est dépassé).
   *
   * Chaque requête est bornée à MAX_DUE_PER_TICK pour ne jamais saturer un tick,
   * et l'ordre croissant traite d'abord les échéances les plus anciennes
   * (aucune famine si plus de campagnes sont échues qu'on n'en traite par tick).
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'push-campaign-scheduler' })
  async sendDueCampaigns(): Promise<void> {
    const now = new Date();

    const [oneShot, recurring] = await Promise.all([
      this.findDue(
        {
          status: PushCampaignStatus.SCHEDULED,
          scheduledAt: LessThanOrEqual(now),
        },
        { scheduledAt: 'ASC' },
        'programmées',
      ),
      this.findDue(
        { status: PushCampaignStatus.ACTIVE, nextRunAt: LessThanOrEqual(now) },
        { nextRunAt: 'ASC' },
        'récurrentes',
      ),
    ]);

    // Une campagne ne peut pas être dans les deux états, mais la déduplication
    // garantit qu'un même id n'est jamais diffusé deux fois dans un tick.
    const seen = new Set<string>();
    for (const campaign of [...oneShot, ...recurring]) {
      if (seen.has(campaign.id)) continue;
      seen.add(campaign.id);
      try {
        await this.processDueCampaign(campaign, now);
      } catch (err) {
        this.logger.error(
          `[PushCampaign] Cron — échec diffusion ${campaign.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  /** Campagnes d'un statut dont la date d'échéance est atteinte. */
  private async findDue(
    where: FindOptionsWhere<PushCampaign>,
    order: FindOptionsOrder<PushCampaign>,
    label: string,
  ): Promise<PushCampaign[]> {
    try {
      return await this.campaignRepo.find({
        where,
        take: this.MAX_DUE_PER_TICK,
        order,
      });
    } catch (err) {
      this.logger.error(
        `[PushCampaign] Cron — lecture des campagnes ${label} impossible: ${(err as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Diffuse une campagne échue puis met à jour son état :
   *  - unique (NONE) → SENT (comportement historique, `scheduledAt` conservé) ;
   *  - récurrente    → runCount++, lastRunAt, `nextRunAt` recalculé
   *                    (COMPLETED dès qu'il n'y a plus d'occurrence).
   */
  private async processDueCampaign(
    campaign: PushCampaign,
    now: Date,
  ): Promise<void> {
    this.logger.log(
      `[PushCampaign] Diffusion ${campaign.id} — « ${campaign.title} » (${campaign.status})`,
    );

    await this.sendCampaign(
      campaign.id,
      campaign.title,
      campaign.body,
      campaign.target,
    );

    const recurrence = campaign.recurrence ?? PushCampaignRecurrence.NONE;
    if (recurrence === PushCampaignRecurrence.NONE) {
      await this.campaignRepo.update(campaign.id, {
        status: PushCampaignStatus.SENT,
      });
      return;
    }

    // Ancre : `scheduledAt` (1ʳᵉ échéance) reste la référence du quantième
    // mensuel et de l'heure par défaut ; `nextRunAt` sert de repli.
    const nextRunAt = computeNextRunAt(
      {
        recurrence,
        anchor: campaign.scheduledAt ?? campaign.nextRunAt ?? now,
        timeOfDay: campaign.timeOfDay,
        daysOfWeek: campaign.daysOfWeek,
        timeZone: campaign.timeZone,
        endsAt: campaign.endsAt,
      },
      now,
    );

    await this.campaignRepo.update(campaign.id, {
      status: nextRunAt
        ? PushCampaignStatus.ACTIVE
        : PushCampaignStatus.COMPLETED,
      nextRunAt,
      lastRunAt: now,
      runCount: (campaign.runCount ?? 0) + 1,
    });

    if (!nextRunAt) {
      this.logger.log(
        `[PushCampaign] ${campaign.id} — récurrence terminée → COMPLETED`,
      );
    } else {
      this.logger.log(
        `[PushCampaign] ${campaign.id} — prochaine diffusion le ${nextRunAt.toISOString()}`,
      );
    }
  }

  /**
   * 📤 Diffuse une campagne aux utilisateurs correspondant à la cible.
   *
   * ⚠️ Régression corrigée : la sélection exigeait `fcmToken IS NOT NULL`.
   * Or le FCM n'est alimenté que par l'app mobile — un client inscrit depuis
   * le web n'a donc AUCUN token. Résultat : la campagne « CLIENT » partait
   * à 0 destinataire malgré des comptes existants.
   *
   * On cible désormais les comptes ACTIFS par rôle, et on délivre via
   * `NotificationStoreService.sendToUsers` : notification in-app déposée en
   * base (visible dans la cloche) + push FCM si un token existe. Aucun
   * e-mail / SMS / WhatsApp — comme les notifications YouTube / WhatsApp.
   */
  private async sendCampaign(
    campaignId: string,
    title: string,
    body: string,
    target: PushCampaignTarget,
  ): Promise<void> {
    const roles = this.getRoleFilter(target);

    const recipients: User[] = [];
    let lastId: string | null = null;

    // Pagination par curseur (keyset) : on ne charge jamais toute la table.
    for (;;) {
      const qb = this.userRepo
        .createQueryBuilder('u')
        .select([
          'u.id',
          'u.email',
          'u.phone',
          'u.fullName',
          'u.fcmToken',
          'u.preferredNotificationChannel',
        ])
        .where('u.isActive = true')
        .andWhere(lastId ? 'u.id > :lastId' : '1 = 1', { lastId })
        .orderBy('u.id', 'ASC')
        .limit(this.BATCH_SIZE);

      if (roles && roles.length > 0) {
        qb.andWhere('u.role IN (:...roles)', { roles });
      }

      const rows = (await qb.getMany()) ?? [];
      if (!Array.isArray(rows) || rows.length === 0) break;

      recipients.push(...rows);
      lastId = rows[rows.length - 1].id;

      if (recipients.length >= this.MAX_RECIPIENTS) {
        this.logger.warn(
          `[PushCampaign] Plafond de ${this.MAX_RECIPIENTS} destinataires atteint — envoi tronqué`,
        );
        break;
      }
      if (rows.length < this.BATCH_SIZE) break;
    }

    await this.campaignRepo.update(campaignId, {
      targetedCount: recipients.length,
    });

    if (recipients.length === 0) {
      await this.campaignRepo.update(campaignId, { recipientCount: 0 });
      this.logger.warn(
        `[PushCampaign] ${campaignId} — aucun compte actif pour la cible=${target}`,
      );
      return;
    }

    let sent = 0;
    for (let i = 0; i < recipients.length; i += this.BATCH_SIZE) {
      const batch = recipients.slice(i, i + this.BATCH_SIZE);
      // Notification in-app + push FCM (jamais d'e-mail/SMS/WhatsApp).
      const created = await this.notificationStore.sendToUsers(
        batch.map((user) => user.id),
        title,
        body,
        NotificationType.PROMOTION,
        '/notifications',
      );
      sent += created;
    }

    await this.campaignRepo.update(campaignId, { recipientCount: sent });
    this.logger.log(
      `[PushCampaign] ${campaignId} envoyé à ${sent}/${recipients.length} destinataires (cible=${target})`,
    );
  }

  async findAll(limit = 50): Promise<PushCampaign[]> {
    return this.campaignRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findOne(id: string): Promise<PushCampaign | null> {
    return this.campaignRepo.findOne({ where: { id } });
  }

  /**
   * 🛑 Arrête une campagne récurrente (ou programme mais pas encore envoyée).
   *
   * Sans cette méthode, une récurrence DAILY serait IMPOSSIBLE à arrêter depuis
   * l'interface : le cron la rediffuserait indéfiniment. On la passe donc à
   * COMPLETED et on neutralise `nextRunAt` pour qu'elle ne soit plus sélectionnée.
   *
   * Une campagne déjà SENT est terminale : on la renvoie telle quelle.
   */
  async stopRecurrence(id: string): Promise<PushCampaign | null> {
    const campaign = await this.findOne(id);
    if (!campaign) return null;
    if (campaign.status === PushCampaignStatus.SENT) return campaign;

    await this.campaignRepo.update(id, {
      status: PushCampaignStatus.COMPLETED,
      nextRunAt: null,
    });
    this.logger.log(`[PushCampaign] ${id} arrêtée manuellement → COMPLETED`);
    return this.findOne(id);
  }
}
