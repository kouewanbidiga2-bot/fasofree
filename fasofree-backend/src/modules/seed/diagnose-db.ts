import { Injectable, Logger } from '@nestjs/common';
import { Command } from 'nestjs-command';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class DiagnoseDbCommand {
  private readonly logger = new Logger(DiagnoseDbCommand.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Command({
    command: 'seed:diagnose',
    describe: 'Diagnostic strict de la base de données - vérifie les comptes réels',
  })
  async diagnose(): Promise<void> {
    console.log('\n🔍 ===== DIAGNOSTIC STRICT BASE DE DONNÉES =====\n');

    const allUsers = await this.userRepository.find();
    console.log(`📊 Total utilisateurs dans la base : ${allUsers.length}`);

    if (allUsers.length === 0) {
      console.log('❌ BASE DE DONNÉES VIDE - Aucun utilisateur trouvé');
      return;
    }

    console.log('\n👥 Liste des utilisateurs réels :');
    console.log('┌──────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ EMAIL                        │ RÔLE           │ ACTIF │ PHONE         │');
    console.log('├──────────────────────────────────────────────────────────────────────────────┤');

    for (const user of allUsers) {
      const email = user.email.padEnd(35);
      const role = user.role.padEnd(15);
      const active = user.isActive ? '✅ OUI' : '❌ NON';
      const phone = user.phone || 'N/A';
      
      console.log(`│ ${email} │ ${role} │ ${active} │ ${phone.padEnd(14)} │`);
    }

    console.log('└──────────────────────────────────────────────────────────────────────────────┘');

    // Vérification spécifique des comptes de test
    const testEmails = ['master@fasofree.bf', 'test.client@fasofree.bf', 'test.merchant@fasofree.bf', 'test.driver@fasofree.bf'];
    
    console.log('\n🎯 Vérification des comptes de test attendus :');
    for (const email of testEmails) {
      const user = await this.userRepository.findOne({ where: { email } });
      if (user) {
        console.log(`✅ ${email} - EXISTS (Role: ${user.role}, Active: ${user.isActive})`);
      } else {
        console.log(`❌ ${email} - DOES NOT EXIST`);
      }
    }

    console.log('\n🔍 ===== FIN DU DIAGNOSTIC =====\n');
  }
}
