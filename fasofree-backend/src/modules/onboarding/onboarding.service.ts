import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { User } from '../users/entities/user.entity';
import { BusinessesService } from '../businesses/businesses.service';
import { WalletService } from '../wallets/wallet.service';
import { UserRole as WalletUserRole } from '../wallets/entities/wallet.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { KycService } from '../kyc/kyc.service';
import { KycStatus } from '../kyc/entities/kyc-document.entity';
import { UserRole } from '../users/entities/user-role.enum';

export interface Moderator {
  userId: string;
  role: UserRole;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly businessesService: BusinessesService,
    private readonly walletService: WalletService,
    private readonly notificationsService: NotificationsService,
    private readonly kycService: KycService,
  ) {}

  /**
   * 📋 Liste les candidatures (Marchands & Livreurs), filtrées par statut / type.
   */
  async list(
    status?: string,
    type?: string,
  ): Promise<User[]> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .where('user.applicationStatus IS NOT NULL')
      .orderBy('user.createdAt', 'DESC');

    if (status) {
      query.andWhere('user.applicationStatus = :status', { status });
    }
    if (type) {
      query.andWhere('user.applicationType = :type', { type });
    }

    return query.getMany();
  }

  /**
   * ✅ Approuve une candidature :
   * - active le compte (isActive = true)
   * - génère un mot de passe temporaire (envoyé au candidat)
   * - crée le profil Business (Marchand) ou finalise le profil Livreur
   * - crée le portefeuille FasoFree (MERCHANT / DRIVER)
   */
  async approve(
    applicationId: string,
    moderator: Moderator,
  ): Promise<{ user: User; tempPassword: string }> {
    const user = await this.findPendingApplication(applicationId);

    // Check KYC status - warn if not all documents are approved
    try {
      const kycDocs = await this.kycService.mine(applicationId);
      const hasApprovedDocs = kycDocs.some(d => d.status === KycStatus.APPROVED);
      if (kycDocs.length === 0) {
        this.logger.warn(`[Onboarding] Aucun document KYC pour ${user.email} - approbation sans vérification KYC`);
      } else if (!hasApprovedDocs) {
        this.logger.warn(`[Onboarding] Documents KYC non approuvés pour ${user.email} - approbation avec mise en garde`);
      }
    } catch {
      this.logger.warn(`[Onboarding] Impossible de vérifier le KYC pour ${user.email}`);
    }

    const tempPassword = `FF-${randomBytes(4).toString('hex').toUpperCase()}`;
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(tempPassword, salt);
    user.isActive = true;
    user.applicationStatus = 'APPROVED';
    user.reviewedBy = moderator.userId;
    user.reviewedAt = new Date();

    const applicationType = user.applicationType;

    if (applicationType === 'MERCHANT') {
      await this.setupMerchantProfile(user);
    } else if (applicationType === 'DRIVER') {
      await this.setupDriverProfile(user);
    }

    await this.userRepository.save(user);

    // 🎉 Envoi multi-canal selon la préférence de l'utilisateur
    await this.notificationsService.sendApprovalNotification(user, tempPassword);

    this.logger.log(
      `[Onboarding] Candidature ${applicationType} approuvée : ${user.email}`,
    );

    return { user, tempPassword };
  }

  /**
   * ❌ Rejette une candidature (motif obligatoire, conservé en base).
   */
  async reject(
    applicationId: string,
    moderator: Moderator,
    reason: string,
  ): Promise<User> {
    if (!reason?.trim()) {
      throw new BadRequestException('Le motif du rejet est obligatoire');
    }
    const user = await this.findPendingApplication(applicationId);

    user.applicationStatus = 'REJECTED';
    user.rejectionReason = reason.trim();
    user.reviewedBy = moderator.userId;
    user.reviewedAt = new Date();
    // isActive reste false : le compte ne peut pas se connecter.

    await this.userRepository.save(user);

    // ❌ Notification de refus multi-canal
    await this.notificationsService.sendRejectionNotification(user, reason);

    this.logger.log(
      `[Onboarding] Candidature rejetée : ${user.email} — ${reason}`,
    );

    return user;
  }

  /**
   * 🏪 Crée le profil Business du marchand approuvé (+ portefeuille MERCHANT).
   */
  private async setupMerchantProfile(user: User): Promise<void> {
    const data = user.applicationData ?? {};
    const business = await this.businessesService.create(
      {
        name: data.businessName || user.fullName,
        address: data.businessAddress || 'Ouagadougou',
        phone: user.phone,
        latitude:
          typeof data.latitude === 'number' ? data.latitude : 12.3714,
        longitude:
          typeof data.longitude === 'number' ? data.longitude : -1.5197,
      },
      user.id,
    );

    if (data.businessCategory) {
      await this.businessesService.update(business.id, {
        category: data.businessCategory,
      });
    }

    // 💰 Portefeuille marchand clé par businessId (convention WalletService)
    await this.walletService.getOrCreateWallet(
      business.id,
      WalletUserRole.MERCHANT,
    );
  }

  /**
   * 🏍️ Finalise le profil Livreur approuvé (+ portefeuille DRIVER).
   */
  private async setupDriverProfile(user: User): Promise<void> {
    const data = user.applicationData ?? {};
    if (data.vehicleType) {
      user.vehicleType = data.vehicleType;
    }

    // 💰 Portefeuille livreur clé par userId (convention WalletService)
    await this.walletService.getOrCreateWallet(user.id, WalletUserRole.DRIVER);
  }

  private async findPendingApplication(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Candidature introuvable');
    }
    if (user.applicationStatus !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Cette candidature a déjà été traitée');
    }
    return user;
  }
}
