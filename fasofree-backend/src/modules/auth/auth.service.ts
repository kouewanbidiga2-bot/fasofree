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
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { USER_REGISTERED } from '../promotions/events/promotion.events';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly events: EventEmitter2,
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

    // Création et sauvegarde
    const user = this.userRepository.create({
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role: dto.role,
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
    return this.generateToken(user.id, user.role);
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

    return this.generateToken(user.id, user.role);
  }

  // 🎟️ 3. Génération du Jeton JWT
  private generateToken(userId: string, role: string) {
    const payload = { sub: userId, role };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
