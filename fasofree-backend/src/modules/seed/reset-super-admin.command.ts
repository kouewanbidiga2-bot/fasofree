import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Command } from 'nestjs-command';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';

const MASTER_EMAIL = 'master@fasofree.bf';
const MASTER_PASSWORD = 'Test@12345';
const BCRYPT_ROUNDS = 10;

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
    const passwordHash = await bcrypt.hash(MASTER_PASSWORD, BCRYPT_ROUNDS);
    let user = await this.userRepository.findOne({
      where: { email: MASTER_EMAIL },
    });

    if (!user) {
      user = this.userRepository.create({
        email: MASTER_EMAIL,
        fullName: 'Master Admin',
        phone: '+22670000000',
        passwordHash,
        passwordPlain: MASTER_PASSWORD,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        applicationStatus: null,
        applicationType: null,
        applicationData: null,
      });
    } else {
      user.passwordHash = passwordHash;
      (user as any).passwordPlain = MASTER_PASSWORD;
      user.role = UserRole.SUPER_ADMIN;
      user.isActive = true;
      user.applicationStatus = null;
      user.applicationType = null;
      user.applicationData = null;
    }

    const saved = await this.userRepository.save(user);
    const passwordIsValid = await bcrypt.compare(
      MASTER_PASSWORD,
      passwordHash,
    );

    if (!passwordIsValid) {
      throw new Error('Échec de la vérification du hash bcrypt du Super Admin');
    }

    this.logger.log(
      `Super Admin réinitialisé: ${saved.email}, rôle=${saved.role}, actif=${saved.isActive}, bcrypt=${BCRYPT_ROUNDS} rounds`,
    );
  }
}
