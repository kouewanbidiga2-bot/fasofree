import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { USER_REGISTERED } from '../promotions/events/promotion.events';
import { SubscriptionService } from '../subscriptions/subscription.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly events: EventEmitter2,
    private readonly subscriptionService: SubscriptionService,
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
      referralCode: `${dto.fullName
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 6)
        .toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`,
    });

    await this.userRepository.save(user);
    this.events.emit(USER_REGISTERED, {
      userId: user.id,
      referralCode: dto.referralCode,
    });

    // Retourner un token d'accès directement après l'inscription
    return this.generateToken(user);
  }

  // 🔑 2. Connexion
  async login(dto: LoginDto) {
    // 💡 On utilise addSelect('user.passwordHash') car il est masqué par défaut dans l'entité
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: dto.email })
      .getOne();

    if (!user) {
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
      isPremium: await this.resolveIsPremium(user),
    };
  }

  // 💎 Client abonné FasoFree Pass VIP ? (frais de plateforme offerts)
  private async resolveIsPremium(user: User): Promise<boolean> {
    if (!user || user.role !== 'client') return false;
    return this.subscriptionService.isVipActive(user.id);
  }

  // 🎟️ 4. Génération du Jeton JWT avec format frontend-compatible
  private async generateToken(user: User) {
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
  }
}
