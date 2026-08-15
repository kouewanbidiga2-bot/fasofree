import { Injectable } from '@nestjs/common';
import { Command, Option } from 'nestjs-command';
import { UsersService } from './users.service';
import { UserRole } from './entities/user-role.enum';

@Injectable()
export class UsersCommand {
  constructor(private readonly usersService: UsersService) {}

  @Command({
    command: 'create:admin',
    describe: 'Crée un compte administrateur',
  })
  async createAdmin(
    @Option({
      name: 'email',
      describe: 'Email du Super Admin',
      type: 'string',
      demandOption: true,
    })
    email: string,
    @Option({
      name: 'password',
      describe: 'Mot de passe',
      type: 'string',
      demandOption: true,
    })
    password: string,
    @Option({
      name: 'role',
      describe: 'Rôle attribué',
      type: 'string',
      default: 'super_admin',
    })
    role: string,
  ) {
    try {
      const formattedRole = (
        role ? role.toLowerCase() : 'super_admin'
      ) as UserRole;

      const user = await this.usersService.create({
        email,
        password,
        role: formattedRole,
      });

      console.log(`\n========================================`);
      console.log(`✅ ADMINISTRATEUR CRÉÉ AVEC SUCCÈS`);
      console.log(`========================================`);
      console.log(`🆔 ID    : ${user.id}`);
      console.log(`📧 Email : ${user.email}`);
      console.log(`🎭 Rôle  : ${user.role}`);
      console.log(`========================================\n`);
    } catch (error) {
      console.error(`\n❌ ÉCHEC : ${error.message}\n`);
    }
  }
}
