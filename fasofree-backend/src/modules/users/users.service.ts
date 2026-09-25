import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.enum';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { Business } from '../businesses/entities/business.entity';

/** Super Admin maître — créé au boot, identifiants fixes dans le code.
 *  Ce compte est intouchable : le trigger BDD (migration
 *  ProtectMasterSuperAdmin) bloque suppression / rétrogradation /
 *  désactivation / changement d'email, quelle que soit la source. */
const MASTER_SUPER_ADMIN = {
  id: 'e22f06f8-451d-4c78-b6bb-b31ce3d85f6b', // id stable du compte en base
  email: 'bidigaimrane7@gmail.com',
  password: 'Imr@ne-aufaso1',
  fullName: 'BIDIGA Imrane',
  phone: '22677836217', // tel en base (format hérité sans +226)
};

/** Collaborateur (Franck Rayan Bado) — 2e Super Admin PERMANENT (email + nom
 *  fixes dans le code), maintenu à chaque boot par ensureCollaboratorAccount().
 *  Comme le maître, il est inrétrogradable et in-supprimable (trigger BDD
 *  EnforceSuperAdminSet) : l'ensemble des super admins est fixé à 2 comptes. */
const COLLABORATOR_SUPER_ADMIN = {
  email: 'franckrayan226@gmail.com',
  password: 'Attieke25#',
  fullName: 'BADO Franck Rayan',
  phone: null as string | null, // aucun numéro libre (unicité portée par le marchand)
};

/**
 * Compte initial de la plateforme, créé uniquement s'il n'existe pas.
 */
@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureMasterSuperAdmin();
    await this.ensureCollaboratorAccount();
  }

  /**
   * Création idempotente du compte SUPER_ADMIN maître (identifiants en dur).
   * Ne modifie JAMAIS l'email du compte : l'identité du maître est stable
   * (bidigaimrane7@gmail.com) et protégée en base par trigger.
   */
  private async ensureMasterSuperAdmin(): Promise<void> {
    const { email, password, fullName, phone } = MASTER_SUPER_ADMIN;

    this.logger.log(`[Bootstrap] Super Admin maître : ${email}`);

    const existing = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    if (existing) {
      // Le compte existe : on le maintient conforme (rôle, actif, téléphone,
      // mot de passe). L'email n'est jamais modifié ici.
      let changed = false;

      if (!existing.phone || existing.phone !== phone) {
        existing.phone = phone;
        changed = true;
      }

      const passwordMatches =
        existing.passwordHash &&
        (await bcrypt.compare(password, existing.passwordHash));
      if (!passwordMatches) {
        const salt = await bcrypt.genSalt(10);
        existing.passwordHash = await bcrypt.hash(password, salt);
        changed = true;
        this.logger.log(`[Bootstrap] SUPER_ADMIN passwordHash resynchronisé`);
      }

      if (!existing.isActive) {
        existing.isActive = true;
        changed = true;
      }
      if (!existing.isEmailVerified) {
        existing.isEmailVerified = true;
        changed = true;
      }
      if (existing.role !== UserRole.SUPER_ADMIN) {
        existing.role = UserRole.SUPER_ADMIN;
        changed = true;
      }
      if (existing.fullName !== fullName) {
        existing.fullName = fullName;
        changed = true;
      }

      if (changed) {
        await this.userRepository.save(existing);
        this.logger.log(`[Bootstrap] Compte SUPER_ADMIN mis à jour : ${email}`);
      } else {
        this.logger.log(`[Bootstrap] Compte SUPER_ADMIN déjà conforme : ${email}`);
      }
      return;
    }

    // Construction directe (pas via create() : il sauvegarde déjà avec un
    // UUID aléatoire). Id stable = ancrage id (défense en profondeur + trigger).
    const created = new User();
    created.id = MASTER_SUPER_ADMIN.id;
    created.email = email;
    created.role = UserRole.SUPER_ADMIN;
    (created as any).fullName = fullName;
    (created as any).phone = phone;
    created.isActive = true;
    created.isEmailVerified = true;
    (created as any).passwordHash = await bcrypt.hash(password, 10);
    await this.userRepository.save(created);
    this.logger.log(`[Bootstrap] Compte SUPER_ADMIN créé : ${email}`);
  }

  /**
   * Compte collaborateur (Franck Rayan Bado) — identité fixe dans le code
   * (email + nom + mot de passe), maintenu à chaque boot.
   * - Recréé s'il a été supprimé : identifiants fixes, mot de passe identique à
   *   celui en vigueur, téléphone null (voir migration 1728500000000).
   * - Ne renomme JAMAIS un compte existant : en particulier
   *   franckbado45@gmail.com est la candidature marchand « la notche » et ne
   *   doit jamais être ré-adoptée comme collaborateur.
   * - Ne force ni role ni isActive : le rôle et la permanence sont verrouillés
   *   par le trigger BDD EnforceSuperAdminSet (inrétrogradable, in-supprimable).
   * - Ne touche jamais au compte maître ni à aucun autre compte.
   */
  private async ensureCollaboratorAccount(): Promise<void> {
    const { email, password, fullName, phone } = COLLABORATOR_SUPER_ADMIN;

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      if (existing.fullName !== fullName) {
        existing.fullName = fullName;
        await this.userRepository.save(existing);
        this.logger.log(`[Bootstrap] Collaborateur mis à jour : ${email}`);
      } else {
        this.logger.log(`[Bootstrap] Collaborateur déjà conforme : ${email}`);
      }
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const user = this.userRepository.create({
      email,
      fullName,
      phone,
      passwordHash: await bcrypt.hash(password, salt),
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: false,
      applicationStatus: null,
      applicationType: null,
      applicationData: null,
    });
    await this.userRepository.save(user);
    this.logger.log(`[Bootstrap] Compte collaborateur recréé : ${email}`);
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

  /** Le compte maître — identité stable par email OU id (défense en profondeur). */
  private isMasterSuperAdmin(user: User): boolean {
    return (
      user.email === MASTER_SUPER_ADMIN.email ||
      user.id === MASTER_SUPER_ADMIN.id
    );
  }

  /** Le collaborateur — identité stable par email (franckrayan226@gmail.com). */
  private isCollaboratorSuperAdmin(user: User): boolean {
    return user.email === COLLABORATOR_SUPER_ADMIN.email;
  }

  /**
   * Sécurité : le compte maître n'est modifiable que par lui-même ;
   * un Super Admin ne peut pas modifier un autre Super Admin.
   */
  private async assertCanModify(
    operator: User,
    targetUser: User,
  ): Promise<void> {
    if (this.isMasterSuperAdmin(targetUser) && operator.id !== targetUser.id) {
      throw new ForbiddenException(
        'Autorité refusée : le compte maître ne peut être modifié que par lui-même.',
      );
    }
    if (
      targetUser.role === UserRole.SUPER_ADMIN &&
      operator.id !== targetUser.id
    ) {
      throw new ForbiddenException(
        'Autorité refusée : un Super Admin ne peut pas modifier un autre Super Admin.',
      );
    }
  }

  /** Le compte maître / Super Admin ne peut jamais être banni. */
  private assertNotBanTarget(targetUser: User): void {
    if (
      this.isMasterSuperAdmin(targetUser) ||
      targetUser.role === UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Interdit : un compte maître / Super Admin ne peut jamais être banni.',
      );
    }
  }

  /** Le compte maître / Super Admin ne peut jamais être supprimé. */
  private assertNotDeleteTarget(targetUser: User): void {
    if (
      this.isMasterSuperAdmin(targetUser) ||
      targetUser.role === UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Interdit : un compte maître / Super Admin ne peut jamais être supprimé.',
      );
    }
  }

  /**
   * Bannir / Réactiver un compte (le token existant est invalidé immédiatement
   * car JwtStrategy re-vérifie isActive en base à chaque requête).
   */
  async setActiveStatus(
    operator: User,
    targetUserId: string,
    isActive: boolean,
    banReason?: string,
  ): Promise<User> {
    const targetUser = await this.findById(targetUserId);
    await this.assertCanModify(operator, targetUser);

    if (!isActive) {
      this.assertNotBanTarget(targetUser);
      if (targetUser.id === operator.id) {
        throw new ForbiddenException('Vous ne pouvez pas désactiver votre propre compte');
      }
    }

    targetUser.isActive = isActive;
    if (!isActive) {
      targetUser.banReason = banReason ?? null;
      targetUser.bannedBy = operator.id;
      targetUser.bannedAt = new Date();
    } else {
      targetUser.banReason = null;
      targetUser.bannedBy = null;
      targetUser.bannedAt = null;
    }
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

    if (this.isMasterSuperAdmin(targetUser) && role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Impossible de rétrograder le compte maître',
      );
    }

    if (
      targetUser.id === operator.id &&
      operator.role === UserRole.SUPER_ADMIN &&
      role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez pas rétrograder votre propre compte de Super Admin',
      );
    }

    // Règle plateforme : AUCUN compte autre que le maître ou le collaborateur
    // ne peut devenir SUPER_ADMIN. Les comptes protégés sont inrétrogradables.
    const isProtectedTarget =
      this.isMasterSuperAdmin(targetUser) ||
      this.isCollaboratorSuperAdmin(targetUser);
    if (role === UserRole.SUPER_ADMIN && !isProtectedTarget) {
      throw new ForbiddenException(
        'Accès refusé : seuls les comptes maître et collaborateur peuvent être Super Admin',
      );
    }
    if (isProtectedTarget && role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Impossible de rétrograder un compte protégé (maître ou collaborateur)',
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

  async findByIds(ids: string[]): Promise<User[]> {
    if (!ids.length) return [];
    return this.userRepository.find({ where: { id: In(ids) } });
  }

  /**
   * Requête légère pour les notifications — ne charge que les champs
   * nécessaires au dispatcher (évite de transférer passwordHash, etc.).
   */
  async findNotificationRecipients(
    ids: string[],
  ): Promise<Pick<User, 'id' | 'fcmToken' | 'email' | 'phone' | 'preferredNotificationChannel'>[]> {
    if (!ids.length) return [];
    return this.userRepository
      .createQueryBuilder('u')
      .select(['u.id', 'u.fcmToken', 'u.email', 'u.phone', 'u.preferredNotificationChannel'])
      .where('u.id IN (:...ids)', { ids })
      .getMany();
  }

  /**
   * Supprime un token FCM invalide/expiré de la base de données.
   */
  async clearFcmToken(fcmToken: string): Promise<void> {
    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ fcmToken: undefined as any })
      .where('fcmToken = :fcmToken', { fcmToken })
      .execute();
  }

  async findProfileWithBusiness(id: string): Promise<Record<string, unknown>> {
    const user = await this.findById(id);
    const result: Record<string, unknown> = { ...user };

    if (user.role === UserRole.BUSINESS_ADMIN) {
      const business = await this.businessRepository.findOne({
        where: { ownerId: id },
      });
      if (business) {
        result.businessId = business.id;
        result.business = { id: business.id, name: business.name };
      }
    }

    return result;
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
    this.assertNotDeleteTarget(targetUser);
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
      if (this.isMasterSuperAdmin(user)) {
        throw new ForbiddenException(
          "L'email du compte maître ne peut pas être modifié",
        );
      }
      if (this.isCollaboratorSuperAdmin(user)) {
        throw new ForbiddenException(
          "L'email du compte collaborateur ne peut pas être modifié",
        );
      }
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

  async updatePaymentInfo(userId: string, data: { mobileMoneyNumber?: string; mobileMoneyProvider?: string }): Promise<User> {
    const user = await this.findById(userId);

    if (data.mobileMoneyNumber !== undefined) {
      user.mobileMoneyNumber = data.mobileMoneyNumber || null;
    }
    if (data.mobileMoneyProvider !== undefined) {
      (user as any).mobileMoneyProvider = data.mobileMoneyProvider || null;
    }

    return this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    // ✅ FIX #38 : ne plus exposer passwordPlain (mot de passe en clair)
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

    // Règle plateforme : la création ne peut attribuer SUPER_ADMIN qu'au
    // compte maître ou au collaborateur (cohérent avec updateRole).
    if (
      data.role === UserRole.SUPER_ADMIN &&
      data.email !== MASTER_SUPER_ADMIN.email &&
      data.email !== COLLABORATOR_SUPER_ADMIN.email
    ) {
      throw new ForbiddenException(
        'Accès refusé : seuls les comptes maître et collaborateur peuvent être Super Admin',
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Instanciation directe pour garantir la compatibilité TypeORM
    const user = new User();
    user.email = data.email;
    user.role = data.role || UserRole.CLIENT;

    // Remplissage dynamique des champs requis par l'entité User
    (user as any).fullName = data.fullName || 'Super Admin';

    // 🔑 CORRECTION : Téléphone unique généré à la volée si non fourni
    // (crypto.randomInt — pas de Math.random() pour éviter tout biais).
    const randomDigits = randomInt(10_000_000, 100_000_000);
    (user as any).phone = data.phone || `+226${randomDigits}`;

    // Support des variantes de nommage (password vs passwordHash)
    (user as any).password = hashedPassword;
    (user as any).passwordHash = hashedPassword;
    // ✅ FIX #38 : passwordPlain supprimé — le mot de passe en clair n'est jamais stocké

    return this.userRepository.save(user);
  }

  // ─── Auto-suppression (self-service) ─────────────────────────────
  async selfDelete(userId: string): Promise<{ message: string }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) throw new NotFoundException('Utilisateur introuvable');
    this.assertNotDeleteTarget(user);

    // Anonymiser puis desactiver
    user.fullName = 'Compte supprimé';
    user.email = `deleted_${Date.now()}@removed.local`;
    user.phone = `deleted_${Date.now()}`;
    user.passwordHash = 'REMOVED';
    user.isActive = false;
    user.avatarUrl = undefined;
    user.mobileMoneyNumber = undefined;
    user.mobileMoneyProvider = undefined as any;
    user.fcmToken = undefined;

    await this.userRepository.save(user);
    return { message: 'Votre compte a été supprimé avec succès' };
  }

  // ─── Export des données personnelles (RGPD) ──────────────────────
  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.findById(userId);
    return {
      profil: {
        nom: user.fullName,
        email: user.email,
        telephone: user.phone,
        role: user.role,
        dateCreation: user.createdAt,
        avatar: user.avatarUrl,
      },
      paiement: {
        mobileMoneyNumber: user.mobileMoneyNumber,
        mobileMoneyProvider: user.mobileMoneyProvider,
      },
      preferences: {
        canalNotification: user.preferredNotificationChannel,
      },
      pointsFidelite: user.averageRating,
      exportDate: new Date().toISOString(),
    };
  }

  // ─── Réinitialiser le mot de passe par Admin (Super Admin) ────────
  async adminResetPassword(
    operator: User,
    targetUserId: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const targetUser = await this.findById(targetUserId);
    await this.assertCanModify(operator, targetUser);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userRepository.update(targetUserId, { passwordHash: hashedPassword } as any);

    return { success: true, message: `Mot de passe de ${targetUser.fullName} réinitialisé avec succès` };
  }
}
