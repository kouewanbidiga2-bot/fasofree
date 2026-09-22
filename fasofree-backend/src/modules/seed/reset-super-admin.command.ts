import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Command } from 'nestjs-command';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { BCRYPT_ROUNDS } from './seed-password';

@Injectable()
export class ResetSuperAdminCommand {
  private readonly logger = new Logger(ResetSuperAdminCommand.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  @Command({
    command: 'seed:super-admin',
    describe: 'Crée ou réinitialise de force le compte Super Admin maître',
  })
  async run(): Promise<void> {
    // Aucun identifiant en dur : les credentials viennent de l'environnement.
    const masterEmail = this.configService.get<string>('SUPER_ADMIN_EMAIL');
    const masterPassword = this.configService.get<string>('SUPER_ADMIN_PASSWORD');

    if (!masterEmail || !masterPassword) {
      this.logger.error(
        '[seed:super-admin] SUPER_ADMIN_EMAIL et SUPER_ADMIN_PASSWORD doivent être définis dans l\'environnement.',
      );
      return;
    }

    const passwordHash = await bcrypt.hash(masterPassword, BCRYPT_ROUNDS);
    let user = await this.userRepository.findOne({
      where: { email: masterEmail },
    });

    if (!user) {
      user = this.userRepository.create({
        email: masterEmail,
        fullName: 'Master Admin',
        phone: '+22670000000',
        passwordHash,
        // ✅ FIX #38 : plus de mot de passe en clair en base
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        applicationStatus: null,
        applicationType: null,
        applicationData: null,
      });
    } else {
      user.passwordHash = passwordHash;
      // ✅ FIX #38 : passwordPlain supprimé
      user.role = UserRole.SUPER_ADMIN;
      user.isActive = true;
      user.applicationStatus = null;
      user.applicationType = null;
      user.applicationData = null;
    }

    const saved = await this.userRepository.save(user);

    this.logger.log(
      `Super Admin réinitialisé: ${saved.email}, rôle=${saved.role}, actif=${saved.isActive}, bcrypt=${BCRYPT_ROUNDS} rounds`,
    );
  }
}
