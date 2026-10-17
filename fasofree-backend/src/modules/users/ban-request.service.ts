import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BanRequest,
  BanRequestStatus,
} from './entities/ban-request.entity';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.enum';
import { CreateBanRequestDto } from './dto/create-ban-request.dto';
import { ReviewBanRequestDto } from './dto/review-ban-request.dto';
import { NotificationStoreService } from '../notifications/notification-store.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class BanRequestService {
  private readonly logger = new Logger(BanRequestService.name);

  constructor(
    @InjectRepository(BanRequest)
    private readonly banRequestRepo: Repository<BanRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationStore: NotificationStoreService,
  ) {}

  /**
   * 📝 Admin/Support soumet une demande de bannissement.
   */
  async create(
    dto: CreateBanRequestDto,
    requesterId: string,
  ): Promise<BanRequest> {
    const requester = await this.userRepo.findOne({
      where: { id: requesterId },
    });
    if (!requester) throw new NotFoundException('Utilisateur introuvable');

    if (
      requester.role !== UserRole.ADMIN &&
      requester.role !== UserRole.SUPPORT &&
      requester.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Seuls les admins et support peuvent soumettre des demandes de ban',
      );
    }

    if (requesterId === dto.targetUserId) {
      throw new ForbiddenException('Vous ne pouvez pas vous bannir vous-même');
    }

    const target = await this.userRepo.findOne({
      where: { id: dto.targetUserId },
    });
    if (!target) throw new NotFoundException('Utilisateur cible introuvable');

    if (target.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Impossible de bannir un super administrateur');
    }

    if (!target.isActive) {
      throw new ConflictException('Cet utilisateur est déjà banni');
    }

    const existing = await this.banRequestRepo.findOne({
      where: {
        targetUserId: dto.targetUserId,
        status: BanRequestStatus.PENDING,
      },
    });
    if (existing) {
      throw new ConflictException(
        'Une demande de bannissement est déjà en cours pour cet utilisateur',
      );
    }

    const request = this.banRequestRepo.create({
      targetUserId: dto.targetUserId,
      requestedBy: requesterId,
      reason: dto.reason.trim(),
      status: BanRequestStatus.PENDING,
    });

    const saved = await this.banRequestRepo.save(request);
    this.logger.log(
      `[BanRequest] Demande créée par ${requester.fullName} → cible ${target.fullName}`,
    );

    // 🔔 Alerte les Super Admin : sans cela, une demande pouvait rester
    // PENDING dans l'onglet sans que personne ne s'en aperçoive.
    await this.notifySuperAdmins(saved, requester, target);

    return saved;
  }

  /**
   * 🔔 Notifie tous les SUPER_ADMIN qu'une demande de bannissement attend
   * une décision. Les erreurs sont isolées : une alerte ratée ne doit jamais
   * faire échouer la création de la demande.
   */
  private async notifySuperAdmins(
    request: BanRequest,
    requester: User,
    target: User,
  ): Promise<void> {
    try {
      const superAdmins = await this.userRepo.find({
        where: { role: UserRole.SUPER_ADMIN, isActive: true },
      });

      if (superAdmins.length === 0) return;

      const subject = 'FasoFree — Demande de bannissement à traiter';
      const message =
        `Une demande de bannissement vient d'être soumise.\n\n` +
        `Cible : ${target.fullName} (${target.email})\n` +
        `Demandé par : ${requester.fullName} (${requester.role})\n` +
        `Motif : ${request.reason}\n\n` +
        `Votre validation est requise dans le back-office.`;

      await Promise.all(
        superAdmins.map(async (admin) => {
          try {
            await this.notificationStore.create({
              userId: admin.id,
              type: NotificationType.SYSTEM,
              title: subject,
              body: message,
            });
          } catch (err) {
            this.logger.warn(
              `[BanRequest] Échec notification admin ${admin.email}: ${(err as Error).message}`,
            );
          }
        }),
      );
    } catch (err) {
      this.logger.warn(
        `[BanRequest] Échec alerte Super Admin: ${(err as Error).message}`,
      );
    }
  }

  /**
   * 📋 Liste les demandes de ban, filtrées par statut.
   */
  async list(status?: BanRequestStatus): Promise<BanRequest[]> {
    const where = status ? { status } : {};
    return this.banRequestRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * ✅❌ Super Admin approuve ou rejette une demande de ban.
   */
  async review(
    requestId: string,
    superAdminId: string,
    dto: ReviewBanRequestDto,
  ): Promise<BanRequest> {
    const admin = await this.userRepo.findOne({
      where: { id: superAdminId },
    });
    if (!admin || admin.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Seul le super administrateur peut évaluer les demandes de ban');
    }

    const request = await this.banRequestRepo.findOne({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Demande introuvable');

    if (request.status !== BanRequestStatus.PENDING) {
      throw new ConflictException('Cette demande a déjà été traitée');
    }

    request.status = dto.status;
    request.reviewedBy = superAdminId;
    request.reviewNote = dto.note?.trim() ?? null;
    request.reviewedAt = new Date();

    await this.banRequestRepo.save(request);

    if (dto.status === BanRequestStatus.APPROVED) {
      const target = await this.userRepo.findOne({
        where: { id: request.targetUserId },
      });
      if (target?.role === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Interdit : un compte Super Admin ne peut jamais être banni.',
        );
      }
      if (target && target.isActive) {
        target.isActive = false;
        target.banReason = request.reason;
        target.bannedBy = superAdminId;
        target.bannedAt = new Date();
        await this.userRepo.save(target);

        this.logger.log(
          `[BanRequest] Utilisateur ${target.fullName} banni par ${admin.fullName}`,
        );

        try {
          await this.notificationStore.create({
            userId: target.id,
            type: NotificationType.ACCOUNT,
            title: 'FasoFree — Votre compte a été suspendu',
            body: `Bonjour ${target.fullName},\n\nVotre compte FasoFree a été suspendu pour la raison suivante :\n\n"${request.reason}"\n\nSi vous pensez qu'il s'agit d'une erreur, contactez le support.`,
          });
        } catch (err) {
          this.logger.warn(`[BanRequest] Échec notification ban: ${(err as Error).message}`);
        }
      }
    } else {
      this.logger.log(
        `[BanRequest] Demande #${requestId} rejetée par ${admin.fullName}`,
      );
    }

    // 🔔 Informe le demandeur (support/admin) de la décision : sans cela il
    // n'a aucun moyen de savoir que sa demande a été traitée.
    await this.notifyRequester(request, admin);

    return request;
  }

  /**
   * 🔔 Notifie l'auteur de la demande de la décision prise.
   */
  private async notifyRequester(
    request: BanRequest,
    admin: User,
  ): Promise<void> {
    try {
      const requester = await this.userRepo.findOne({
        where: { id: request.requestedBy },
      });
      if (!requester || requester.id === admin.id) return;

      const approved = request.status === BanRequestStatus.APPROVED;
      await this.notificationStore.create({
        userId: requester.id,
        type: NotificationType.SYSTEM,
        title: approved
          ? 'FasoFree — Votre demande de bannissement a été approuvée'
          : 'FasoFree — Votre demande de bannissement a été rejetée',
        body: approved
          ? `Le Super Admin ${admin.fullName} a approuvé votre demande. Le compte concerné a été banni.${request.reviewNote ? `\n\nNote : ${request.reviewNote}` : ''}`
          : `Le Super Admin ${admin.fullName} a rejeté votre demande.${request.reviewNote ? `\n\nMotif : ${request.reviewNote}` : ''}`,
      });
    } catch (err) {
      this.logger.warn(
        `[BanRequest] Échec notification demandeur: ${(err as Error).message}`,
      );
    }
  }

  /**
   * 📊 Compteur de demandes en attente (pour le badge UI).
   */
  async pendingCount(): Promise<number> {
    return this.banRequestRepo.count({
      where: { status: BanRequestStatus.PENDING },
    });
  }
}
