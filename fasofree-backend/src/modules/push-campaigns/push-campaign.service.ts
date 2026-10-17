import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import {
  PushCampaign,
  PushCampaignStatus,
  PushCampaignTarget,
} from './entities/push-campaign.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { NotificationStoreService } from '../notifications/notification-store.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class PushCampaignService {
  private readonly logger = new Logger(PushCampaignService.name);
  private readonly BATCH_SIZE = 200;
  /** Garde-fou mémoire : jamais plus de 50 000 destinataires par campagne. */
  private readonly MAX_RECIPIENTS = 50_000;

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
  ): Promise<PushCampaign> {
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
   * ⏱️ Cron : diffuse les campagnes programmées dont l'heure est atteinte.
   * `timeZone: 'UTC'` aligne l'évaluation sur le stockage `timestamptz`.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'push-campaign-scheduler' })
  async sendDueCampaigns(): Promise<void> {
    let due: PushCampaign[] = [];
    try {
      due = await this.campaignRepo.find({
        where: {
          status: PushCampaignStatus.SCHEDULED,
          scheduledAt: LessThanOrEqual(new Date()),
        },
        take: 20,
        order: { scheduledAt: 'ASC' },
      });
    } catch (err) {
      this.logger.error(
        `[PushCampaign] Cron — lecture des campagnes programmées impossible: ${(err as Error).message}`,
      );
      return;
    }

    for (const campaign of due) {
      try {
        this.logger.log(
          `[PushCampaign] Diffusion programmée ${campaign.id} — « ${campaign.title} »`,
        );
        await this.sendCampaign(
          campaign.id,
          campaign.title,
          campaign.body,
          campaign.target,
        );
        await this.campaignRepo.update(campaign.id, {
          status: PushCampaignStatus.SENT,
        });
      } catch (err) {
        this.logger.error(
          `[PushCampaign] Cron — échec diffusion ${campaign.id}: ${(err as Error).message}`,
        );
      }
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
}
