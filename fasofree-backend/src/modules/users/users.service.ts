import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

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

    // 🛡️ SÉCURITÉ : Empêcher un Super Admin d'agir sur un autre Super Admin
    if (
      targetUser.role === UserRole.SUPER_ADMIN &&
      operator.id !== targetUser.id // S'il ne s'agit pas de son propre compte
    ) {
      throw new ForbiddenException(
        'Autorité refusée : Un Super Admin ne peut pas modifier ou supprimer un autre Super Admin.',
      );
    }
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
