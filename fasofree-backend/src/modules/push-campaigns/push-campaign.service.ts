import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PushCampaign,
  PushCampaignTarget,
} from './entities/push-campaign.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { NotificationsService } from '../notifications/notifications.service';

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
    private readonly notifications: NotificationsService,
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
  ): Promise<PushCampaign> {
    const campaign = await this.campaignRepo.save(
      this.campaignRepo.create({
        title,
        body,
        target,
        sentBy: sentBy || null,
        recipientCount: 0,
      }),
    );

    // ⚠️ L'envoi part en arrière-plan : on ne bloque PAS la réponse HTTP sur
    // N appels FCM. On journalise les erreurs pour ne jamais laisser un
    // rejet non capté tuer le process.
    void this.sendCampaign(campaign.id, title, body, target).catch((err) => {
      this.logger.error(
        `[PushCampaign] Échec envoi async: ${(err as Error).message}`,
      );
    });

    return campaign;
  }

  private async sendCampaign(
    campaignId: string,
    title: string,
    body: string,
    target: PushCampaignTarget,
  ): Promise<void> {
    const roles = this.getRoleFilter(target);

    // Requêtes par lots : on ne charge jamais toute la table `users` en RAM.
    const tokens: string[] = [];
    let lastId: string | null = null;

    for (;;) {
      const qb = this.userRepo
        .createQueryBuilder('u')
        .select('u.id', 'id')
        .addSelect('u.fcmToken', 'fcmToken')
        .where('u.fcmToken IS NOT NULL')
        .andWhere("u.fcmToken != ''")
        .andWhere('u.isActive = true')
        // Pagination par curseur (keyset) : robuste même si la table grossit.
        .andWhere(lastId ? 'u.id > :lastId' : '1 = 1', { lastId })
        .orderBy('u.id', 'ASC')
        .limit(this.BATCH_SIZE);

      if (roles && roles.length > 0) {
        qb.andWhere('u.role IN (:...roles)', { roles });
      }

      const rows = await qb.getRawMany<{ id: string; fcmToken: string }>();
      if (rows.length === 0) break;

      tokens.push(...rows.map((r) => r.fcmToken).filter(Boolean));
      lastId = rows[rows.length - 1].id;

      if (tokens.length >= this.MAX_RECIPIENTS) {
        this.logger.warn(
          `[PushCampaign] Plafond de ${this.MAX_RECIPIENTS} destinataires atteint — envoi tronqué`,
        );
        break;
      }
      if (rows.length < this.BATCH_SIZE) break;
    }

    if (tokens.length === 0) {
      await this.campaignRepo.update(campaignId, { recipientCount: 0 });
      this.logger.log(
        `[PushCampaign] ${campaignId} — aucun destinataire (cible=${target})`,
      );
      return;
    }

    let sent = 0;
    for (let i = 0; i < tokens.length; i += this.BATCH_SIZE) {
      const batch = tokens.slice(i, i + this.BATCH_SIZE);
      const results = await Promise.all(
        batch.map((token) =>
          this.notifications.sendToDevice(token, {
            title,
            body,
            data: { campaignId },
          }),
        ),
      );
      sent += results.filter(Boolean).length;
    }

    await this.campaignRepo.update(campaignId, { recipientCount: sent });
    this.logger.log(
      `[PushCampaign] ${campaignId} envoyé à ${sent}/${tokens.length} destinataires (cible=${target})`,
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
