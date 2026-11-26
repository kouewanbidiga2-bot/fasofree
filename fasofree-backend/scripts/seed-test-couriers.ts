/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/**
 * Comptes livreurs de test.
 *
 * Crée (ou remet à neuf) trois comptes coursier prêts à se connecter dans
 * l'app `fasofree-frontend` : rôle `driver`, compte vérifié, candidature
 * approuvée, contrat-cadre livreur (FR-LIVR-006) déjà signé — sans quoi l'app
 * renverrait l'utilisateur sur l'écran de signature — et portefeuille DRIVER
 * vide pour suivre les gains.
 *
 * Usage :
 *   DATABASE_URL="postgresql://…" npm run seed:couriers
 *
 * Le script ne synchronise pas le schéma (`synchronize: false`) et se contente
 * d'upserts par email : il peut être relancé sans doublon. Le mot de passe est
 * commun aux trois comptes et n'est affiché qu'à la fin.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User, VehicleType } from '../src/modules/users/entities/user.entity';
import { UserRole } from '../src/modules/users/entities/user-role.enum';
import { Wallet } from '../src/modules/wallets/entities/wallet.entity';
import { UserRole as WalletRole } from '../src/modules/wallets/entities/wallet.entity';
import { ContractAcceptance } from '../src/modules/legal/entities/contract-acceptance.entity';

/** Contrat exigé pour le rôle livreur (`LegalService.requiredContractDoc`). */
const DRIVER_CONTRACT = { docCode: 'FR-LIVR-006', docVersion: '1.0' };

const PASSWORD = 'Koliwa2026';

const ACCOUNTS = [
  { fullName: 'Ibrahim Sawadogo', email: 'livreur1@koliwa.test', phone: '+22670000011' },
  { fullName: 'Aminata Ouédraogo', email: 'livreur2@koliwa.test', phone: '+22670000012' },
  { fullName: 'Salif Kaboré', email: 'livreur3@koliwa.test', phone: '+22670000013' },
];

const buildDataSource = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL absent. Ajoutez-la dans fasofree-backend/.env (ou passez-la en variable d'environnement) puis relancez `npm run seed:couriers`.",
    );
  }

  return new DataSource({
    type: 'postgres',
    url,
    entities: [User, Wallet, ContractAcceptance],
    // Jamais de synchronize ici : on ne modifie pas le schéma d'une base qui
    // sert déjà l'application.
    synchronize: false,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
};

const run = async () => {
  const dataSource = buildDataSource();
  await dataSource.initialize();

  const users = dataSource.getRepository(User);
  const wallets = dataSource.getRepository(Wallet);
  const contracts = dataSource.getRepository(ContractAcceptance);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const created: string[] = [];

  try {
    for (const account of ACCOUNTS) {
      let user = await users.findOne({ where: { email: account.email } });

      if (!user) {
        user = users.create({
          fullName: account.fullName,
          email: account.email,
          phone: account.phone,
          passwordHash,
          role: UserRole.DRIVER,
          isActive: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          applicationStatus: 'APPROVED',
          applicationType: 'DRIVER',
          vehicleType: VehicleType.MOTORCYCLE,
          isOnline: false,
          isAvailable: true,
          mobileMoneyProvider: null,
          mobileMoneyNumber: account.phone,
        });
        user = await users.save(user);
      } else {
        // Compte déjà présent : on réinitialise juste ce qui bloque la connexion.
        await users.update(
          { id: user.id },
          {
            passwordHash,
            role: UserRole.DRIVER,
            isActive: true,
            isEmailVerified: true,
            isPhoneVerified: true,
            applicationStatus: 'APPROVED',
            applicationType: 'DRIVER',
            vehicleType: VehicleType.MOTORCYCLE,
          },
        );
      }

      const signed = await contracts.findOne({
        where: {
          userId: user.id,
          docCode: DRIVER_CONTRACT.docCode,
          docVersion: DRIVER_CONTRACT.docVersion,
        },
      });

      if (!signed) {
        await contracts.save(
          contracts.create({
            userId: user.id,
            docCode: DRIVER_CONTRACT.docCode,
            docVersion: DRIVER_CONTRACT.docVersion,
            mechanism: 'signature-otp',
            source: 'seed-test-couriers',
            ip: null,
          }),
        );
      }

      const wallet = await wallets.findOne({
        where: { userId: user.id, userRole: WalletRole.DRIVER },
      });

      if (!wallet) {
        await wallets.save(
          wallets.create({
            userId: user.id,
            userRole: WalletRole.DRIVER,
            branchId: null,
            currency: 'XOF',
            isActive: true,
            balance: 0,
            availableBalance: 0,
            heldBalance: 0,
          }),
        );
      }

      created.push(`${account.email}  ·  ${account.fullName}  ·  ${account.phone}`);
    }
  } finally {
    await dataSource.destroy();
  }

  console.log('\nComptes coursier de test prêts :\n');
  created.forEach((line) => console.log(`  ${line}`));
  console.log(`\nMot de passe commun : ${PASSWORD}`);
  console.log("Connexion : app coursier (fasofree-frontend), écran « Se connecter ».\n");
};

run().catch((error) => {
  console.error(`\nÉchec du seed : ${error.message}\n`);
  process.exitCode = 1;
});
