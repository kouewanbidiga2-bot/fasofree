import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.enum';

/**
 * 🧑💼 Compte initial de la plateforme, créé uniquement s'il n'existe pas.
 * Seul compte créé automatiquement — les autres comptes sont créés par ce
 * SUPER_ADMIN via le Dashboard (POST /users).
 */
const MASTER_SUPER_ADMIN = {
  email: 'master@fasofree.bf',
  password: 'Master@2024',
  fullName: 'Master Admin',
};

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureMasterSuperAdmin();
  }

  /**
   * 🌱 Création idempotente du compte SUPER_ADMIN initial.
   */
  private async ensureMasterSuperAdmin(): Promise<void> {
    const existing = await this.userRepository.findOne({
      where: { email: MASTER_SUPER_ADMIN.email },
    });
    if (existing) return;

    await this.create({
      email: MASTER_SUPER_ADMIN.email,
      password: MASTER_SUPER_ADMIN.password,
      role: UserRole.SUPER_ADMIN,
      fullName: MASTER_SUPER_ADMIN.fullName,
    });
    this.logger.log(
      `[Bootstrap] Compte SUPER_ADMIN initial créé : ${MASTER_SUPER_ADMIN.email}`,
    );
  }

  // 👤 Obtenir un utilisateur par son ID
  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.userRepository.update(userId, { fcmToken });
  }

  async updateUser(
    operator: User,
    targetUserId: string,
    updateData: Partial<User>,
  ) {
    const targetUser = await this.findById(targetUserId);
    await this.assertCanModify(operator, targetUser);
  }

  /**
   * 🛡️ Sécurité : un Super Admin ne peut PAS modifier un autre Super Admin.
   */
  private async assertCanModify(
    operator: User,
    targetUser: User,
  ): Promise<void> {
    if (
      targetUser.role === UserRole.SUPER_ADMIN &&
      operator.id !== targetUser.id
    ) {
      throw new ForbiddenException(
        'Autorité refusée : Un Super Admin ne peut pas modifier ou supprimer un autre Super Admin.',
      );
    }
  }

  /**
   * 🚫 Bannir / Réactiver un compte (le token existant est invalidé immédiatement
   * car JwtStrategy re-vérifie isActive en base à chaque requête).
   */
  async setActiveStatus(
    operator: User,
    targetUserId: string,
    isActive: boolean,
  ): Promise<User> {
    const targetUser = await this.findById(targetUserId);
    await this.assertCanModify(operator, targetUser);

    if (!isActive && targetUser.id === operator.id) {
      throw new ForbiddenException('Vous ne pouvez pas désactiver votre propre compte');
    }

    targetUser.isActive = isActive;
    return this.userRepository.save(targetUser);
  }

  /**
   * 🔄 Changer le rôle d'un utilisateur. Interdit de se rétrograder soi-même
   * (évite de perdre le dernier SUPER_ADMIN).
   */
  async updateRole(
    operator: User,
    targetUserId: string,
    role: UserRole,
  ): Promise<User> {
    const targetUser = await this.findById(targetUserId);
    await this.assertCanModify(operator, targetUser);

    if (
      targetUser.id === operator.id &&
      operator.role === UserRole.SUPER_ADMIN &&
      role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez pas rétrograder votre propre compte de Super Admin',
      );
    }

    targetUser.role = role;
    return this.userRepository.save(targetUser);
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  // 🛡️ Lister tous les utilisateurs (Admin)
  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  // ➕ Méthode de création isolée & typée pour la CLI et l'Auth
  async create(data: {
    email: string;
    password: string;
    role?: UserRole;
    fullName?: string;
    phone?: string;
  }): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new ConflictException(`L'utilisateur ${data.email} existe déjà.`);
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Instanciation directe pour garantir la compatibilité TypeORM
    const user = new User();
    user.email = data.email;
    user.role = data.role || UserRole.SUPER_ADMIN;

    // Remplissage dynamique des champs requis par l'entité User
    (user as any).fullName = data.fullName || 'Super Admin';

    // 🔑 CORRECTION : Téléphone unique généré à la volée si non fourni
    const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
    (user as any).phone = data.phone || `+226${randomDigits}`;

    // Support des variantes de nommage (password vs passwordHash)
    (user as any).password = hashedPassword;
    (user as any).passwordHash = hashedPassword;

    return this.userRepository.save(user);
  }
}
