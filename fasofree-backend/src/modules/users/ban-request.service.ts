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
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BanRequestService {
  private readonly logger = new Logger(BanRequestService.name);

  constructor(
    @InjectRepository(BanRequest)
    private readonly banRequestRepo: Repository<BanRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
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
    return saved;
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
      if (target && target.isActive) {
        target.isActive = false;
        target.banReason = request.reason;
        target.bannedBy = superAdminId;
        target.bannedAt = new Date();
        await this.userRepo.save(target);

        this.logger.log(
          `[BanRequest] Utilisateur ${target.fullName} banni par ${admin.fullName}`,
        );

        if (target.email) {
          try {
            await this.notificationsService.sendNotification(
              target,
              'FasoFree — Votre compte a été suspendu',
              `Bonjour ${target.fullName},\n\nVotre compte FasoFree a été suspendu pour la raison suivante :\n\n"${request.reason}"\n\nSi vous pensez qu'il s'agit d'une erreur, contactez le support.`,
            );
          } catch (err) {
            this.logger.warn(`[BanRequest] Échec notification ban: ${(err as Error).message}`);
          }
        }
      }
    } else {
      this.logger.log(
        `[BanRequest] Demande #${requestId} rejetée par ${admin.fullName}`,
      );
    }

    return request;
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
