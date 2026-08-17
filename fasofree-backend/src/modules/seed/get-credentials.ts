import { Injectable, Logger } from '@nestjs/common';
import { Command } from 'nestjs-command';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';

@Injectable()
export class GetCredentialsCommand {
  private readonly logger = new Logger(GetCredentialsCommand.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Command({
    command: 'seed:get-credentials',
    describe: 'Récupère tous les identifiants de test existants',
  })
  async getCredentials(): Promise<void> {
    console.log('\n🔑 ===== IDENTIFIANTS DE TEST FASOFREE =====\n');

    const users = await this.userRepository.find({
      order: { role: 'ASC' },
    });

    console.log('┌──────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ RÔLE           │ INTERFACE           │ EMAIL                        │ MOT DE PASSE    │');
    console.log('├──────────────────────────────────────────────────────────────────────────────┤');

    for (const user of users) {
      const role = user.role;
      let interfaceUrl = '';
      
      if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) {
        interfaceUrl = 'Dashboard Admin (port 5173)';
      } else if (role === UserRole.BUSINESS_ADMIN) {
        interfaceUrl = 'Dashboard Marchand (port 5173)';
      } else if (role === UserRole.DRIVER) {
        interfaceUrl = 'Dashboard Livreur (port 5173)';
      } else {
        interfaceUrl = 'App Client (port 3000)';
      }

      const email = user.email.padEnd(35);
      const roleStr = role.padEnd(15);
      const interfaceStr = interfaceUrl.padEnd(25);
      
      console.log(`│ ${roleStr} │ ${interfaceStr} │ ${email} │ Test@12345     │`);
    }

    console.log('└──────────────────────────────────────────────────────────────────────────────┘');
    console.log(`\n📊 Total utilisateurs : ${users.length}`);
    console.log('💡 Note : Le mot de passe par défaut est "Test@12345" pour tous les comptes de test\n');
  }
}
