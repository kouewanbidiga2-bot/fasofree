import { Injectable, ConflictException, UnauthorizedException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { User, NotificationChannel } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ApplyDto } from './dto/apply.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { USER_REGISTERED } from '../promotions/events/promotion.events';
import { SubscriptionService } from '../subscriptions/subscription.service';
import { KycService } from '../kyc/kyc.service';
import { KycDocumentType } from '../kyc/entities/kyc-document.entity';
import { UsersService } from '../users/users.service';

/** Champs fichiers KYC acceptés dans la candidature multipart */
const KYC_FILE_FIELDS: Record<string, KycDocumentType> = {
  identityCard: KycDocumentType.IDENTITY_CARD,
  driverLicense: KycDocumentType.DRIVER_LICENSE,
  vehicleRegistration: KycDocumentType.VEHICLE_REGISTRATION,
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly events: EventEmitter2,
    private readonly subscriptionService: SubscriptionService,
    private readonly kycService: KycService,
    private readonly usersService: UsersService,
  ) {}

  // 📝 1. Inscription d'un nouvel utilisateur
  async register(dto: RegisterDto) {
    // Vérifier si l'email ou le téléphone existe déjà
    const existingUser = await this.userRepository.findOne({
      where: [{ email: dto.email }, { phone: dto.phone }],
    });

    if (existingUser) {
      throw new ConflictException(
        'Un compte existe déjà avec cet email ou ce numéro de téléphone',
      );
    }

    // 🔒 Hachage du mot de passe avec Bcrypt (Salt factor = 10)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    // 🛡️ SÉCURITÉ : L'inscription publique ne crée QUE des comptes CLIENT.
    // Les rôles sensibles (SUPER_ADMIN, ADMIN, SUPPORT) ne peuvent être
    // créés que par un SUPER_ADMIN connecté via POST /users.
    const user = this.userRepository.create({
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role: UserRole.CLIENT,
      preferredNotificationChannel: dto.preferredNotificationChannel || NotificationChannel.EMAIL,
      referralCode: `${dto.fullName
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 6)
        .toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`,
    });

    await this.userRepository.save(user);

    try {
      this.events.emit(USER_REGISTERED, {
        userId: user.id,
        referralCode: dto.referralCode,
      });
    } catch (err) {
      this.logger.warn(`Event USER_REGISTERED emit failed: ${(err as Error).message}`);
    }

    // Retourner un token JWT — l'utilisateur est connecté mais doit vérifier son compte via OTP
    return this.generateToken(user);
  }

  // 🚦 1bis. Candidature MARCHAND / LIVREUR (onboarding avec KYC)
  async apply(
    dto: ApplyDto,
    files?: Record<string, Express.Multer.File[]>,
  ): Promise<{ message: string; applicationId: string; role: string }> {
    // Vérifier si l'email ou le téléphone existe déjà
    const existingUser = await this.userRepository.findOne({
      where: [{ email: dto.email }, { phone: dto.phone }],
    });

    if (existingUser) {
      throw new ConflictException(
        'Un compte existe déjà avec cet email ou ce numéro de téléphone',
      );
    }

    // Validation métier des champs spécifiques au rôle
    if (dto.role === 'MERCHANT') {
      if (!dto.businessName || !dto.businessAddress) {
        throw new BadRequestException(
          "Le nom et l'adresse du commerce sont obligatoires pour une candidature marchand",
        );
      }
    }

    // 🔒 SÉCURITÉ : l'inscription publique ne crée QUE des candidats en attente.
    // Le compte est désactivé (isActive=false) jusqu'à l'approbation par
    // l'administration. Le rôle final est posé immédiatement mais le JWT est
    // inutilisable (JwtStrategy re-vérifie isActive à chaque requête).
    const targetRole =
      dto.role === 'MERCHANT' ? UserRole.BUSINESS_ADMIN : UserRole.DRIVER;

    const applicationData: Record<string, any> = {
      role: dto.role,
    };

    if (dto.role === 'MERCHANT') {
      applicationData.businessName = dto.businessName;
      applicationData.businessAddress = dto.businessAddress;
      if (dto.businessCategory) {
        applicationData.businessCategory = dto.businessCategory;
      }
      if (dto.latitude !== undefined && dto.longitude !== undefined) {
        applicationData.latitude = dto.latitude;
        applicationData.longitude = dto.longitude;
      }
    } else {
      if (dto.vehicleType) applicationData.vehicleType = dto.vehicleType;
      if (dto.driverLicenseNumber) {
        applicationData.driverLicenseNumber = dto.driverLicenseNumber;
      }
      if (dto.hasAirConditioning !== undefined) {
        applicationData.hasAirConditioning = dto.hasAirConditioning;
      }
      if (dto.vehicleCategory) {
        applicationData.vehicleCategory = dto.vehicleCategory;
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = this.userRepository.create({
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role: targetRole,
      isActive: false,
      applicationStatus: 'PENDING_APPROVAL',
      applicationType: dto.role,
      applicationData,
      preferredNotificationChannel: dto.preferredNotificationChannel || NotificationChannel.EMAIL,
      referralCode: `${dto.fullName
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 6)
        .toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`,
    });

    await this.userRepository.save(user);

    // 📎 Documents KYC fournis dans la candidature (via KycService existant)
    if (files) {
      for (const [field, type] of Object.entries(KYC_FILE_FIELDS)) {
        const uploaded = files[field];
        if (uploaded && uploaded.length > 0) {
          await this.kycService.submit(user.id, type, uploaded[0]);
        }
      }
    }

    return {
      message:
        'Candidature envoyée avec succès. Notre équipe examine votre dossier ; vous recevrez vos identifiants après validation.',
      applicationId: user.id,
      role: dto.role,
    };
  }

  // 🔑 2. Connexion (email OU téléphone)
  async login(dto: LoginDto) {
    const identifier = dto.email.trim();

    // Détecter si c'est un téléphone (commence par + ou contient 8+ chiffres)
    const isPhone = /^\+?\d{8,}$/.test(identifier.replace(/\s/g, ''));

    const qb = this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash');

    if (isPhone) {
      qb.where('user.phone = :identifier', { identifier });
    } else {
      qb.where('LOWER(user.email) = LOWER(:identifier)', { identifier });
    }

    const user = await qb.getOne();

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Vérification du mot de passe
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (user.applicationStatus === 'PENDING_APPROVAL') {
      // 🚦 Compte candidat (marchand/livreur) encore en cours d'examen :
      // on bloque le login tant que l'administration n'a pas validé le dossier.
      throw new ForbiddenException(
        "Votre compte est en cours d'examen par FasoFree. Vous recevrez vos identifiants après validation de votre dossier.",
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Ce compte est désactivé');
    }

    return this.generateToken(user);
  }

  // 👤 3. Obtenir le profil utilisateur connecté
  async getMe(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      referralCode: user.referralCode,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      isPremium: await this.resolveIsPremium(user),
      applicationStatus: user.applicationStatus,
      applicationType: user.applicationType,
      vehicleType: user.vehicleType,
    };
  }

  // 💎 Client abonné FasoFree Pass VIP ? (frais de plateforme offerts)
  private async resolveIsPremium(user: User): Promise<boolean> {
    try {
      if (!user || user.role !== 'client') return false;
      return await this.subscriptionService.isVipActive(user.id);
    } catch (err) {
      this.logger.warn(`resolveIsPremium failed for ${user?.id}: ${(err as Error).message}`);
      return false;
    }
  }

  // 🔑 5. Demande de réinitialisation du mot de passe
  async forgotPassword(email: string): Promise<void> {
    const result = await this.usersService.generatePasswordResetToken(email);
    if (result) {
      // TODO: envoyer un email avec le lien de réinitialisation
      this.logger.log(`Token de réinitialisation généré pour ${email}`);
    }
    // Ne jamais révéler si l'email existe ou non
  }

  // 🔑 6. Réinitialiser le mot de passe avec le token
  async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword) {
      throw new BadRequestException('Token et nouveau mot de passe requis');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères');
    }
    return this.usersService.resetPassword(token, newPassword);
  }

  // 🔑 7. Changer le mot de passe (utilisateur connecté)
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Mot de passe actuel et nouveau mot de passe requis');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException('Le nouveau mot de passe doit contenir au moins 8 caractères');
    }
    return this.usersService.changePassword(userId, currentPassword, newPassword);
  }

  // 🎟️ 4. Génération du Jeton JWT avec format frontend-compatible
  private async generateToken(user: User) {
    try {
      const payload = { sub: user.id, role: user.role };
      const accessToken = this.jwtService.sign(payload);

      return {
        access_token: accessToken,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive,
          isPremium: await this.resolveIsPremium(user),
        },
      };
    } catch (err) {
      this.logger.error(`generateToken FAILED for user ${user?.id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
