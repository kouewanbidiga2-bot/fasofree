import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Command } from 'nestjs-command';
import { Repository } from 'typeorm';
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
  ) {}

  @Command({
    command: 'seed:super-admin',
    describe: 'Crée ou réinitialise de force le compte Super Admin maître',
  })
  async run(): Promise<void> {
    const masterEmail = 'bidigaimrane7@gmail.com';
    const masterPassword = 'Imr@ne-aufaso1';

    const passwordHash = await bcrypt.hash(masterPassword, BCRYPT_ROUNDS);
    let user = await this.userRepository.findOne({
      where: { email: masterEmail },
    });

    if (!user) {
      user = this.userRepository.create({
        email: masterEmail,
        fullName: 'BIDIGA Imrane',
        phone: '22677836217',
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
