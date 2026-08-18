import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.enum';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';

/**
 * 🧑💼 Compte initial de la plateforme, créé uniquement s'il n'existe pas.
 * Seul compte créé automatiquement — les autres comptes sont créés par ce
 * SUPER_ADMIN via le Dashboard (POST /users).
 */
const MASTER_SUPER_ADMIN = {
  email: 'kouewanbidiga2@gmail.com',
  password: 'Test@12345',
  fullName: 'Master Admin',
  phone: '+22661010011',
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
   * Ré-hache le mot de passe si passwordHash est absent (ancien seed).
   */
  private async ensureMasterSuperAdmin(): Promise<void> {
    // Chercher le SUPER_ADMIN par email ou par rôle (pour migrer l'ancien compte)
    let existing = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: MASTER_SUPER_ADMIN.email })
      .getOne();

    if (!existing) {
      // Ancien compte avec master@fasofree.bf → le migrer
      existing = await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.role = :role', { role: UserRole.SUPER_ADMIN })
        .getOne();
    }

    if (existing) {
      let changed = false;

      // Mettre à jour email si ancien
      if (existing.email !== MASTER_SUPER_ADMIN.email) {
        this.logger.log(`[Bootstrap] Migration email SUPER_ADMIN : ${existing.email} → ${MASTER_SUPER_ADMIN.email}`);
        existing.email = MASTER_SUPER_ADMIN.email;
        changed = true;
      }

      // Mettre à jour phone si manquant ou ancien
      if (!existing.phone || existing.phone !== MASTER_SUPER_ADMIN.phone) {
        existing.phone = MASTER_SUPER_ADMIN.phone;
        changed = true;
      }

      // Ré-hacher le password si manquant
      if (!existing.passwordHash) {
        const salt = await bcrypt.genSalt(10);
        existing.passwordHash = await bcrypt.hash(MASTER_SUPER_ADMIN.password, salt);
        changed = true;
        this.logger.log(`[Bootstrap] SUPER_ADMIN passwordHash manquant → ré-haché`);
      }

      if (changed) {
        await this.userRepository.save(existing);
      }
      return;
    }

    await this.create({
      email: MASTER_SUPER_ADMIN.email,
      password: MASTER_SUPER_ADMIN.password,
      role: UserRole.SUPER_ADMIN,
      fullName: MASTER_SUPER_ADMIN.fullName,
      phone: MASTER_SUPER_ADMIN.phone,
    });
    this.logger.log(
      `[Bootstrap] Compte SUPER_ADMIN initial créé : ${MASTER_SUPER_ADMIN.email}`,
    );
  }

  // 👤 Obtenir un utilisateur par son ID
  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.userRepository.update(userId, { fcmToken });
  }

  /**
   * 🛵 Statut de disponibilité d'un livreur / coursier (online, GPS, véhicule).
   * Réservé aux rôles DRIVER et COURIER.
   */
  async setDriverStatus(
    userId: string,
    dto: UpdateDriverStatusDto,
  ): Promise<User> {
    const user = await this.findById(userId);

    if (user.role !== UserRole.DRIVER && user.role !== UserRole.COURIER) {
      throw new ForbiddenException(
        'Seuls les livreurs (DRIVER) et coursiers (COURIER) peuvent gérer leur disponibilité',
      );
    }

    if (dto.isOnline !== undefined) user.isOnline = dto.isOnline;
    if (dto.isAvailable !== undefined) user.isAvailable = dto.isAvailable;
    if (dto.latitude !== undefined) user.latitude = dto.latitude;
    if (dto.longitude !== undefined) user.longitude = dto.longitude;
    if (dto.vehicleType !== undefined) user.vehicleType = dto.vehicleType;

    return this.userRepository.save(user);
  }

  /**
   * 🛵 Met à jour la position GPS persistée d'un livreur (appelé par le
   * streaming socket `updateDriverLocation`, throttlé côté handler).
   * Best-effort : n'échoue jamais le flux temps réel.
   */
  async updateDriverPosition(
    driverId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    if (!driverId || latitude == null || longitude == null) return;
    await this.userRepository
      .update(driverId, { latitude, longitude })
      .catch(() => undefined);
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

  /**
   * 🗑️ Supprimer définitivement un compte utilisateur.
   * Interdit de supprimer un autre SUPER_ADMIN.
   */
  async deleteUser(
    operator: User,
    targetUserId: string,
  ): Promise<{ message: string }> {
    const targetUser = await this.findById(targetUserId);
    await this.assertCanModify(operator, targetUser);

    if (targetUser.id === operator.id) {
      throw new ForbiddenException('Vous ne pouvez pas supprimer votre propre compte');
    }

    await this.userRepository.remove(targetUser);
    return { message: `Utilisateur ${targetUser.email} supprimé définitivement` };
  }

  /**
   * 🔑 Réinitialisation du mot de passe : générer un token de réinitialisation.
   */
  async generatePasswordResetToken(email: string): Promise<{ token: string } | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Ne pas révéler si l'email existe ou non (sécurité)
      return null;
    }

    const token = require('crypto').randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 heure

    (user as any).passwordResetToken = token;
    (user as any).passwordResetExpires = expires;
    await this.userRepository.save(user);

    return { token };
  }

  /**
   * 🔑 Réinitialiser le mot de passe avec un token valide.
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user."passwordResetToken" = :token', { token })
      .getOne();

    if (!user) {
      throw new ForbiddenException('Token de réinitialisation invalide');
    }

    if (
      !(user as any).passwordResetExpires ||
      new Date((user as any).passwordResetExpires) < new Date()
    ) {
      throw new ForbiddenException('Token de réinitialisation expiré');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    (user as any).passwordHash = hashedPassword;
    (user as any).passwordResetToken = null;
    (user as any).passwordResetExpires = null;
    await this.userRepository.save(user);

    return { message: 'Mot de passe réinitialisé avec succès' };
  }

  /**
   * 🔑 Changer le mot de passe d'un utilisateur connecté.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, (user as any).passwordHash);
    if (!isPasswordValid) {
      throw new ForbiddenException('Mot de passe actuel incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    (user as any).passwordHash = hashedPassword;
    await this.userRepository.save(user);

    return { message: 'Mot de passe changé avec succès' };
  }

  /**
   * 👤 Mettre à jour le profil de l'utilisateur connecté (nom, email, téléphone).
   */
  async updateProfile(
    userId: string,
    data: { fullName?: string; email?: string; phone?: string; preferredNotificationChannel?: string },
  ): Promise<User> {
    const user = await this.findById(userId);

    if (data.email && data.email !== user.email) {
      const existing = await this.userRepository.findOne({ where: { email: data.email } });
      if (existing) {
        throw new ConflictException(`L'adresse email ${data.email} est déjà utilisée.`);
      }
      user.email = data.email;
    }

    if (data.phone && data.phone !== user.phone) {
      const existing = await this.userRepository.findOne({ where: { phone: data.phone } });
      if (existing) {
        throw new ConflictException(`Le numéro ${data.phone} est déjà utilisé.`);
      }
      user.phone = data.phone;
    }

    if (data.fullName !== undefined) {
      user.fullName = data.fullName;
    }

    if (data.preferredNotificationChannel !== undefined) {
      (user as any).preferredNotificationChannel = data.preferredNotificationChannel;
    }

    return this.userRepository.save(user);
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<User> {
    const user = await this.findById(userId);
    user.avatarUrl = avatarUrl;
    return this.userRepository.save(user);
  }

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
