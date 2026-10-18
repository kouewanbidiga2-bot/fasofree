import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsOrder,
  FindOptionsWhere,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import { randomUUID } from 'crypto';
import {
  PushCampaign,
  PushCampaignAudience,
  PushCampaignRecurrence,
  PushCampaignStatus,
  PushCampaignTarget,
  DEFAULT_CAMPAIGN_TIMEZONE,
} from './entities/push-campaign.entity';
import { computeNextRunAt, RecurrenceSpec } from './push-campaign-recurrence';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { Business } from '../businesses/entities/business.entity';
import { DeliveryAgency } from '../dispatch/entities/delivery-agency.entity';
import { NotificationStoreService } from '../notifications/notification-store.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { WalletService } from '../wallets/wallet.service';
import { UserRole as WalletUserRole } from '../wallets/entities/wallet.entity';
import { TransactionReason } from '../wallets/entities/wallet-transaction.entity';

/**
 * 💳 Prix par défaut d'une campagne AUTO-SERVICE, en FCFA — PAR EXÉCUTION
 * (et non par destinataire). Surchargeable par la variable d'environnement
 * `PUSH_CAMPAIGN_UNIT_PRICE_FCFA`.
 */
export const DEFAULT_PUSH_CAMPAIGN_UNIT_PRICE_XOF = 100;

/**
 * 🔁 Options de `createCampaign`.
 * Objet (et non paramètres positionnels) pour ne pas casser les appels
 * existants `createCampaign(title, body, target, sentBy, scheduledAt)`.
 */
export interface CreatePushCampaignOptions {
  recurrence?: PushCampaignRecurrence | null;
  timeOfDay?: string | null;
  daysOfWeek?: number[] | null;
  timeZone?: string | null;
  endsAt?: Date | null;
  /** 🎯 Audience auto-service (Lot 3). NULL = campagne admin (par rôle). */
  audience?: PushCampaignAudience | null;
  /** 💳 Compte payeur. NULL = campagne admin, non facturée. */
  ownerUserId?: string | null;
}

/** Entrée d'une campagne auto-service (marchand ou agence). */
export interface SelfServiceCampaignInput {
  title: string;
  body: string;
  audience: PushCampaignAudience;
  scheduledAt?: Date | null;
  recurrence?: PushCampaignRecurrence | null;
  timeOfDay?: string | null;
  daysOfWeek?: number[] | null;
  timeZone?: string | null;
  endsAt?: Date | null;
}

/** Décrit QUI doit recevoir une diffusion. */
type AudienceSpec =
  | { kind: 'TARGET'; target: PushCampaignTarget }
  | {
      kind: 'AUDIENCE';
      audience: PushCampaignAudience;
      ownerUserId: string;
    };

/** Résultat d'une tentative de facturation (jamais d'exception jetée). */
type ChargeOutcome =
  | { ok: true; amount: number; walletTransactionId: string | null }
  | { ok: false; reason: string };

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
    private readonly walletService: WalletService,
    private readonly configService: ConfigService,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(DeliveryAgency)
    private readonly agencyRepo: Repository<DeliveryAgency>,
  ) {}

  /**
   * 💳 Prix d'une campagne auto-service, en FCFA, PAR EXÉCUTION.
   *
   * Le prix ne dépend PAS du nombre de destinataires : envoyer à 10 clients ou
   * à 5 000 coûte le même montant. Une campagne récurrente est débitée à
   * chaque exécution du cron (100 F par diffusion, pas par abonnement).
   */
  get unitPriceXof(): number {
    const raw = this.configService?.get?.('PUSH_CAMPAIGN_UNIT_PRICE_FCFA');
    if (raw === undefined || raw === null || raw === '') {
      return DEFAULT_PUSH_CAMPAIGN_UNIT_PRICE_XOF;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : DEFAULT_PUSH_CAMPAIGN_UNIT_PRICE_XOF;
  }

  /**
   * Rôles correspondant à chaque cible.
   * ⚠️ `RIDER` et `MERCHANT` n'existent PAS dans `UserRole` : ils sont mappés
   * ici sur les libellés réels du domaine (COURIER pour les livreurs,
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

  // ======================================================================
  //  CRÉATION
  // ======================================================================

  async createCampaign(
    title: string,
    body: string,
    target: PushCampaignTarget,
    sentBy?: string | null,
    scheduledAt?: Date | null,
    options?: CreatePushCampaignOptions,
  ): Promise<PushCampaign> {
    const recurrence = options?.recurrence ?? PushCampaignRecurrence.NONE;
    const audience = options?.audience ?? null;
    const ownerUserId = options?.ownerUserId ?? null;
    const timeZone =
      (options?.timeZone || '').trim() || DEFAULT_CAMPAIGN_TIMEZONE;
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
      return this.persistRecurring({
        title,
        body,
        target,
        sentBy,
        scheduledAt,
        recurrence,
        timeOfDay,
        daysOfWeek,
        timeZone,
        endsAt,
        audience,
        ownerUserId,
      });
    }

    // ⏱️ Programmation : une date dans le futur diffuse plus maintenant.
    // (Aucune facturation ici : le cron débitera au moment de l'exécution.)
    const isScheduled =
      scheduledAt instanceof Date &&
      !Number.isNaN(scheduledAt.getTime()) &&
      scheduledAt.getTime() > Date.now();

    if (isScheduled) {
      const campaign = await this.campaignRepo.save(
        this.campaignRepo.create({
          title,
          body,
          target,
          sentBy: sentBy || null,
          status: PushCampaignStatus.SCHEDULED,
          scheduledAt,
          audience,
          ownerUserId,
          recipientCount: 0,
          targetedCount: 0,
        }),
      );
      this.logger.log(
        `[PushCampaign] ${campaign.id} programmée pour ${scheduledAt?.toISOString()} (cible=${target})`,
      );
      return campaign;
    }

    // ─── 💳 AUTO-SERVICE : facturé, résultat déterministe ──────────
    // Une campagne auto-service ne part JAMAIS en arrière-plan : l'opérateur
    // doit savoir tout de suite si elle est partie et ce qu'elle a coûté.
    if (ownerUserId) {
      return this.sendSelfServiceNow({
        title,
        body,
        target,
        sentBy,
        audience,
        ownerUserId,
      });
    }

    // ─── 📣 Campagne admin (gratuite) : comportement historique ────
    const campaign = await this.campaignRepo.save(
      this.campaignRepo.create({
        title,
        body,
        target,
        sentBy: sentBy || null,
        status: PushCampaignStatus.SENT,
        scheduledAt: null,
        audience: null,
        ownerUserId: null,
        recipientCount: 0,
        targetedCount: 0,
      }),
    );

    // ⚠️ L'envoi part en arrière-plan : on ne bloque PAS la réponse HTTP sur
    // N envois. On journalise les erreurs pour ne jamais laisser un rejet non
    // capté tuer le process.
    void this.sendCampaign(
      campaign.id,
      title,
      body,
      this.audienceSpecOf(campaign),
    ).catch((err) => {
      this.logger.error(
        `[PushCampaign] Échec envoi async: ${(err as Error).message}`,
      );
    });

    return campaign;
  }

  /**
   * 📣 Crée une campagne auto-service (Lot 3) pour un marchand ou une agence.
   *
   * Règles anti-spam : un BUSINESS_ADMIN ne peut viser que ses propres clients
   * (OWN_CLIENTS) ou tous les clients de la plateforme (ALL_CLIENTS) ; une
   * AGENCY ne peut viser que ses propres livreurs (OWN_DRIVERS) ou tous les
   * clients. `ALL` (toute la base) reste inaccessible.
   *
   * Facturation : 100 FCFA par EXÉCUTION.
   *  - envoi immédiat → débit immédiat, avant diffusion ;
   *  - envoi programmé / récurrent → débit à chaque passage du cron.
   */
  async createSelfServiceCampaign(
    operatorUserId: string,
    operatorRole: UserRole,
    operatorLabel: string,
    input: SelfServiceCampaignInput,
  ): Promise<PushCampaign> {
    this.assertAudienceAllowed(operatorRole, input.audience);

    // `target` n'est qu'un libellé grossier (affichage + rétro-compatibilité
    // des colonnes existantes) : l'audience réelle est portée par `audience`.
    const target =
      input.audience === PushCampaignAudience.OWN_DRIVERS
        ? PushCampaignTarget.DRIVER
        : PushCampaignTarget.CLIENT;

    return this.createCampaign(
      input.title,
      input.body,
      target,
      operatorLabel,
      input.scheduledAt ?? null,
      {
        recurrence: input.recurrence ?? PushCampaignRecurrence.NONE,
        timeOfDay: input.timeOfDay ?? null,
        daysOfWeek: input.daysOfWeek ?? null,
        timeZone: input.timeZone ?? null,
        endsAt: input.endsAt ?? null,
        audience: input.audience,
        ownerUserId: operatorUserId,
      },
    );
  }

  /** Enregistre une campagne récurrente et calcule sa 1ʳᵉ échéance. */
  private async persistRecurring(params: {
    title: string;
    body: string;
    target: PushCampaignTarget;
    sentBy?: string | null;
    scheduledAt?: Date | null;
    recurrence: PushCampaignRecurrence;
    timeOfDay: string | null;
    daysOfWeek: number[] | null;
    timeZone: string;
    endsAt: Date | null;
    audience: PushCampaignAudience | null;
    ownerUserId: string | null;
  }): Promise<PushCampaign> {
    const validScheduled =
      params.scheduledAt instanceof Date &&
      !Number.isNaN(params.scheduledAt.getTime())
        ? params.scheduledAt
        : null;
    const anchor = validScheduled ?? new Date();
    const spec: RecurrenceSpec = {
      recurrence: params.recurrence,
      anchor,
      timeOfDay: params.timeOfDay,
      daysOfWeek: params.daysOfWeek,
      timeZone: params.timeZone,
      endsAt: params.endsAt,
    };
    const firstRunAt = computeNextRunAt(spec, new Date());

    const campaign = await this.campaignRepo.save(
      this.campaignRepo.create({
        title: params.title,
        body: params.body,
        target: params.target,
        sentBy: params.sentBy || null,
        status: firstRunAt
          ? PushCampaignStatus.ACTIVE
          : PushCampaignStatus.COMPLETED,
        // `scheduledAt` garde la 1ʳᵉ échéance (affichage), `nextRunAt` pilote
        // le cron — les deux coïncident au départ.
        scheduledAt: firstRunAt,
        recurrence: params.recurrence,
        timeOfDay: params.timeOfDay,
        daysOfWeek: params.daysOfWeek,
        timeZone: params.timeZone,
        nextRunAt: firstRunAt,
        lastRunAt: null,
        endsAt: params.endsAt,
        runCount: 0,
        recipientCount: 0,
        targetedCount: 0,
        audience: params.audience,
        ownerUserId: params.ownerUserId,
      }),
    );

    if (!firstRunAt) {
      this.logger.warn(
        `[PushCampaign] ${campaign.id} récurrente (${params.recurrence}) sans prochaine occurrence — endsAt déjà dépassé ? → COMPLETED`,
      );
    } else {
      this.logger.log(
        `[PushCampaign] ${campaign.id} récurrente (${params.recurrence}${params.timeOfDay ? ` à ${params.timeOfDay}` : ''} ${params.timeZone}) — 1ʳᵉ diffusion le ${firstRunAt.toISOString()}`,
      );
    }
    return campaign;
  }

  /**
   * 💳 Diffusion IMMÉDIATE d'une campagne auto-service.
   *
   * Ordre volontaire : on résout l'audience (pour ne pas facturer un envoi à
   * zéro destinataire), on DÉBITE, puis on persiste et on diffuse. Un échec de
   * débit remonte donc en 400 AVANT toute écriture : jamais de campagne
   * fantôme, jamais d'envoi gratuit.
   */
  private async sendSelfServiceNow(params: {
    title: string;
    body: string;
    target: PushCampaignTarget;
    sentBy?: string | null;
    audience: PushCampaignAudience | null;
    ownerUserId: string;
  }): Promise<PushCampaign> {
    const spec: AudienceSpec = {
      kind: 'AUDIENCE',
      audience: params.audience ?? PushCampaignAudience.ALL_CLIENTS,
      ownerUserId: params.ownerUserId,
    };

    const { userIds, label } = await this.resolveRecipients(spec);
    if (userIds.length === 0) {
      throw new BadRequestException(
        "Aucun destinataire éligible pour cette audience — aucun débit n'a été effectué.",
      );
    }

    const charge = await this.chargeOwner(
      params.ownerUserId,
      this.unitPriceXof,
      `PUSHCAMP-${randomUUID()}`,
      params.title,
    );
    if (!charge.ok) {
      throw new BadRequestException(charge.reason);
    }

    const campaign = await this.campaignRepo.save(
      this.campaignRepo.create({
        title: params.title,
        body: params.body,
        target: params.target,
        sentBy: params.sentBy || null,
        status: PushCampaignStatus.SENT,
        scheduledAt: null,
        audience: params.audience,
        ownerUserId: params.ownerUserId,
        billedXof: charge.amount,
        walletTransactionId: charge.walletTransactionId,
        runCount: 1,
        recipientCount: 0,
        targetedCount: userIds.length,
      }),
    );

    // La campagne est déjà payée et enregistrée : un échec de diffusion ne
    // doit pas transformer la réponse en erreur (l'opérateur verrait « 500 »
    // alors qu'il a été débité). On journalise sans jeter.
    try {
      await this.deliver(campaign.id, params.title, params.body, userIds);
      this.logger.log(
        `[PushCampaign] Auto-service ${campaign.id} envoyé (${label}) — facturé ${charge.amount} FCFA`,
      );
    } catch (err) {
      this.logger.error(
        `[PushCampaign] Auto-service ${campaign.id} — échec diffusion: ${(err as Error).message}`,
      );
    }

    return (await this.findOne(campaign.id)) ?? campaign;
  }

  // ======================================================================
  //  CRON
  // ======================================================================

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
   * Facture puis diffuse une campagne échue, et met à jour son état :
   *  - facturation refusée (solde insuffisant) → AUCUN envoi, campagne
   *    SUSPENDUE (COMPLETED + `failureReason`) et opérateur notifié ;
   *  - unique (NONE) → SENT (comportement historique, `scheduledAt` conservé) ;
   *  - récurrente    → runCount++, lastRunAt, `nextRunAt` recalculé
   *                    (COMPLETED dès qu'il n'y a plus d'occurrence).
   *
   * ⚠️ POURQUOI SUSPENDRE au lieu de réessayer : le cron tourne CHAQUE MINUTE.
   * Une campagne récurrente impayée serait retentée indéfiniment, en échouant
   * à chaque tick — et en notifiant l'opérateur 1 440 fois par jour.
   */
  private async processDueCampaign(
    campaign: PushCampaign,
    now: Date,
  ): Promise<void> {
    const charge = await this.chargeCampaignRun(campaign);
    if (!charge.ok) {
      await this.campaignRepo.update(campaign.id, {
        status: PushCampaignStatus.COMPLETED,
        nextRunAt: null,
        failureReason: charge.reason,
      });
      await this.notifyOwnerOfSuspension(campaign, charge.reason);
      this.logger.warn(
        `[PushCampaign] ${campaign.id} suspendue faute de paiement: ${charge.reason}`,
      );
      return;
    }

    this.logger.log(
      `[PushCampaign] Diffusion ${campaign.id} — « ${campaign.title} » (${campaign.status})`,
    );

    await this.sendCampaign(
      campaign.id,
      campaign.title,
      campaign.body,
      this.audienceSpecOf(campaign),
    );

    const recurrence = campaign.recurrence ?? PushCampaignRecurrence.NONE;
    if (recurrence === PushCampaignRecurrence.NONE) {
      await this.campaignRepo.update(campaign.id, {
        status: PushCampaignStatus.SENT,
        billedXof: charge.amount,
        walletTransactionId: charge.walletTransactionId,
        failureReason: null,
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
      billedXof: charge.amount,
      walletTransactionId: charge.walletTransactionId,
      failureReason: null,
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

  // ======================================================================
  //  DIFFUSION
  // ======================================================================

  /**
   * 📤 Diffuse une campagne aux destinataires de son audience.
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
    spec: AudienceSpec,
  ): Promise<void> {
    const { userIds, label } = await this.resolveRecipients(spec);

    await this.campaignRepo.update(campaignId, {
      targetedCount: userIds.length,
    });

    if (userIds.length === 0) {
      await this.campaignRepo.update(campaignId, { recipientCount: 0 });
      this.logger.warn(
        `[PushCampaign] ${campaignId} — aucun compte actif pour ${label}`,
      );
      return;
    }

    const sent = await this.deliver(campaignId, title, body, userIds);
    this.logger.log(
      `[PushCampaign] ${campaignId} envoyé à ${sent}/${userIds.length} destinataires (${label})`,
    );
  }

  /** Dépose la notification in-app (+ push FCM si token) par lots de 200. */
  private async deliver(
    campaignId: string,
    title: string,
    body: string,
    userIds: string[],
  ): Promise<number> {
    let sent = 0;
    for (let i = 0; i < userIds.length; i += this.BATCH_SIZE) {
      const batch = userIds.slice(i, i + this.BATCH_SIZE);
      // Notification in-app + push FCM (jamais d'e-mail/SMS/WhatsApp).
      const created = await this.notificationStore.sendToUsers(
        batch,
        title,
        body,
        NotificationType.PROMOTION,
        '/notifications',
      );
      sent += created;
    }

    await this.campaignRepo.update(campaignId, { recipientCount: sent });
    return sent;
  }

  /** Traduit la campagne persistée en descriptif d'audience. */
  private audienceSpecOf(campaign: {
    target: PushCampaignTarget;
    audience?: PushCampaignAudience | null;
    ownerUserId?: string | null;
  }): AudienceSpec {
    if (campaign.audience && campaign.ownerUserId) {
      return {
        kind: 'AUDIENCE',
        audience: campaign.audience,
        ownerUserId: campaign.ownerUserId,
      };
    }
    return { kind: 'TARGET', target: campaign.target };
  }

  /** Résout les destinataires + un libellé de log. */
  private async resolveRecipients(
    spec: AudienceSpec,
  ): Promise<{ userIds: string[]; label: string }> {
    if (spec.kind === 'TARGET') {
      const userIds = await this.findActiveUserIds({
        roles: this.getRoleFilter(spec.target),
      });
      return { userIds, label: `cible=${spec.target} (${userIds.length})` };
    }
    return this.resolveAudienceUserIds(spec.audience, spec.ownerUserId);
  }

  /**
   * 🎯 Résolution des audiences auto-service.
   *
   * Anti-spam : un marchand ne voit QUE les clients qui lui ont réellement
   * commandé (via `orders.businessId`) ; une agence ne voit QUE les livreurs
   * rattachés à elle (`users.agencyId`). `ALL_CLIENTS` reste limité au rôle
   * CLIENT — jamais les livreurs, jamais les admins.
   */
  private async resolveAudienceUserIds(
    audience: PushCampaignAudience,
    ownerUserId: string,
  ): Promise<{ userIds: string[]; label: string }> {
    switch (audience) {
      case PushCampaignAudience.OWN_CLIENTS: {
        const businessIds = await this.findOwnedBusinessIds(ownerUserId);
        const userIds = businessIds.length
          ? await this.notificationStore.findClientsOfBusinesses(businessIds)
          : [];
        return {
          userIds,
          label: `audience=OWN_CLIENTS (${userIds.length})`,
        };
      }

      case PushCampaignAudience.OWN_DRIVERS: {
        const agency = await this.agencyRepo.findOne({
          where: { userId: ownerUserId },
        });
        if (!agency) {
          return { userIds: [], label: 'audience=OWN_DRIVERS (aucune agence)' };
        }
        const userIds = await this.findActiveUserIds({
          roles: [UserRole.DRIVER, UserRole.COURIER],
          agencyId: agency.id,
        });
        return {
          userIds,
          label: `audience=OWN_DRIVERS (${userIds.length})`,
        };
      }

      case PushCampaignAudience.ALL_CLIENTS:
      default: {
        const userIds = await this.findActiveUserIds({
          roles: [UserRole.CLIENT],
        });
        return {
          userIds,
          label: `audience=ALL_CLIENTS (${userIds.length})`,
        };
      }
    }
  }

  /**
   * 📄 Ids des comptes ACTIFS (pagination par curseur keyset) — on ne charge
   * jamais toute la table `users` d'un coup, et on plafonne à MAX_RECIPIENTS.
   */
  private async findActiveUserIds(opts: {
    roles?: UserRole[] | null;
    agencyId?: string;
  }): Promise<string[]> {
    const ids: string[] = [];
    let lastId: string | null = null;

    for (;;) {
      const qb = this.userRepo
        .createQueryBuilder('u')
        .select(['u.id'])
        .where('u.isActive = true')
        .andWhere(lastId ? 'u.id > :lastId' : '1 = 1', { lastId })
        .orderBy('u.id', 'ASC')
        .limit(this.BATCH_SIZE);

      if (opts.roles && opts.roles.length > 0) {
        qb.andWhere('u.role IN (:...roles)', { roles: opts.roles });
      }
      if (opts.agencyId) {
        qb.andWhere('u.agencyId = :agencyId', { agencyId: opts.agencyId });
      }

      const rows = (await qb.getMany()) ?? [];
      if (!Array.isArray(rows) || rows.length === 0) break;

      ids.push(...rows.map((r) => r.id));
      lastId = rows[rows.length - 1].id;

      if (ids.length >= this.MAX_RECIPIENTS) {
        this.logger.warn(
          `[PushCampaign] Plafond de ${this.MAX_RECIPIENTS} destinataires atteint — audience tronquée`,
        );
        break;
      }
      if (rows.length < this.BATCH_SIZE) break;
    }

    return ids;
  }

  /** Commerces dont ce compte est propriétaire (`businesses.ownerId`). */
  private async findOwnedBusinessIds(ownerUserId: string): Promise<string[]> {
    try {
      const businesses = await this.businessRepo.find({
        where: { ownerId: ownerUserId },
        select: { id: true },
      });
      return businesses.map((b) => b.id);
    } catch (err) {
      this.logger.warn(
        `[PushCampaign] Lecture des commerces de ${ownerUserId} impossible: ${(err as Error).message}`,
      );
      return [];
    }
  }

  /** Bannit les audiences non autorisées pour ce rôle (anti-spam). */
  private assertAudienceAllowed(
    role: UserRole,
    audience: PushCampaignAudience,
  ): void {
    const allowed: Partial<Record<UserRole, PushCampaignAudience[]>> = {
      [UserRole.BUSINESS_ADMIN]: [
        PushCampaignAudience.OWN_CLIENTS,
        PushCampaignAudience.ALL_CLIENTS,
      ],
      [UserRole.AGENCY]: [
        PushCampaignAudience.OWN_DRIVERS,
        PushCampaignAudience.ALL_CLIENTS,
      ],
    };
    const list = allowed[role] ?? [];
    if (!list.includes(audience)) {
      throw new ForbiddenException(
        list.length
          ? `Audience « ${audience} » non autorisée pour ce compte. Valeurs acceptées : ${list.join(', ')}.`
          : 'Ce compte ne peut pas envoyer de campagne push.',
      );
    }
  }

  // ======================================================================
  //  FACTURATION
  // ======================================================================

  /** Facture l'exécution d'une campagne (0 F pour une campagne admin). */
  private async chargeCampaignRun(
    campaign: PushCampaign,
  ): Promise<ChargeOutcome> {
    // Campagne admin (aucun payeur) → gratuite : comportement historique.
    if (!campaign.ownerUserId) {
      return {
        ok: true,
        amount: campaign.billedXof ?? 0,
        walletTransactionId: campaign.walletTransactionId ?? null,
      };
    }

    return this.chargeOwner(
      campaign.ownerUserId,
      this.unitPriceXof,
      // Référence stable par exécution : une éventuelle double exécution du
      // cron sur le même run est dédupliquée par `debitWallet`.
      `PUSHCAMP-${campaign.id}-${campaign.runCount ?? 0}`,
      campaign.title,
      campaign.billedXof ?? 0,
    );
  }

  /**
   * 💳 Débite le portefeuille du compte payeur.
   *
   * ⚠️ Rôle de portefeuille : le module Wallet ne connaît PAS de rôle AGENCY
   * (`wallets_userrole_enum` = DRIVER/COURIER/MERCHANT/CUSTOMER/SUPER_ADMIN).
   * Une société de livraison utilise donc le portefeuille que son tableau de
   * bord affiche déjà, c'est-à-dire le portefeuille MARCHAND de son compte.
   *
   * On tente d'abord les portefeuilles de BRANCHE (c'est là qu'atterrissent les
   * règlements marchands — `merchant-financial.service`), puis le portefeuille
   * global. Le premier qui peut payer gagne ; sinon l'erreur est remontée
   * telle quelle (message « solde insuffisant » actionnable).
   */
  private async chargeOwner(
    ownerUserId: string,
    amount: number,
    reference: string,
    title: string,
    billedSoFar = 0,
  ): Promise<ChargeOutcome> {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: true, amount: billedSoFar, walletTransactionId: null };
    }

    const businessIds = await this.findOwnedBusinessIds(ownerUserId);
    const candidates: (string | null)[] = [...businessIds, null];

    // Garantit l'existence du portefeuille global : sans cela, un compte
    // n'ayant jamais rechargé obtiendrait « portefeuille introuvable » au lieu
    // du message actionnable « solde insuffisant ».
    await this.walletService.getOrCreateWallet(
      ownerUserId,
      WalletUserRole.MERCHANT,
    );

    let lastError: unknown = null;
    for (const branchId of candidates) {
      try {
        const { transaction } = await this.walletService.debitWallet(
          ownerUserId,
          WalletUserRole.MERCHANT,
          amount,
          TransactionReason.PUSH_CAMPAIGN_FEE,
          reference,
          `Campagne push « ${title.slice(0, 60)} »`,
          branchId ?? undefined,
        );
        return {
          ok: true,
          amount: billedSoFar + amount,
          walletTransactionId: transaction.id,
        };
      } catch (err) {
        lastError = err;
      }
    }

    const message =
      lastError instanceof Error ? lastError.message : 'erreur inconnue';
    return {
      ok: false,
      reason: `Paiement de ${amount} FCFA refusé : ${message}`.slice(0, 300),
    };
  }

  /** Prévient l'opérateur (in-app) que sa campagne a été suspendue. */
  private async notifyOwnerOfSuspension(
    campaign: PushCampaign,
    reason: string,
  ): Promise<void> {
    if (!campaign.ownerUserId) return;
    try {
      await this.notificationStore.create({
        userId: campaign.ownerUserId,
        type: NotificationType.SYSTEM,
        title: 'Campagne push suspendue',
        body: `« ${campaign.title} » n'a pas été envoyée : ${reason}`,
        actionUrl: '/dashboard',
      });
    } catch (err) {
      this.logger.warn(
        `[PushCampaign] Notification de suspension non délivrée: ${(err as Error).message}`,
      );
    }
  }

  // ======================================================================
  //  LECTURE / ARRÊT
  // ======================================================================

  async findAll(limit = 50): Promise<PushCampaign[]> {
    return this.campaignRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /** Campagnes auto-service d'un opérateur (il ne voit QUE les siennes). */
  async findByOwner(ownerUserId: string, limit = 50): Promise<PushCampaign[]> {
    return this.campaignRepo.find({
      where: { ownerUserId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findOne(id: string): Promise<PushCampaign | null> {
    return this.campaignRepo.findOne({ where: { id } });
  }

  /**
   * 🛑 Arrête une campagne récurrente (ou programmée mais pas encore envoyée).
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

  /**
   * 🛑 Arrêt d'une campagne auto-service, réservé à son propriétaire.
   * Retourne `null` si la campagne n'existe pas OU n'appartient pas au compte :
   * un opérateur ne doit jamais pouvoir arrêter la campagne d'un autre.
   */
  async stopOwnedCampaign(
    id: string,
    ownerUserId: string,
  ): Promise<PushCampaign | null> {
    const campaign = await this.campaignRepo.findOne({
      where: { id, ownerUserId },
    });
    if (!campaign) return null;
    return this.stopRecurrence(id);
  }
}
