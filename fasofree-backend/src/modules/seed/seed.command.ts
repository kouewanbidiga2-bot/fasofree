import { Injectable, Logger } from '@nestjs/common';
import { Command } from 'nestjs-command';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { UserRole as AppUserRole } from '../users/entities/user-role.enum';
import { BusinessesService } from '../businesses/businesses.service';
import { Business } from '../businesses/entities/business.entity';
import { BrandsService } from '../brands/brands.service';
import { Brand } from '../brands/entities/brand.entity';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionSubjectType,
} from '../subscriptions/entities/subscription.entity';
import { WalletService } from '../wallets/wallet.service';
import { UserRole as WalletUserRole } from '../wallets/entities/wallet.entity';
import { TransactionReason } from '../wallets/entities/wallet-transaction.entity';
import { Product } from '../products/entities/product.entity';

const SEED_PASSWORD = 'Test@12345';

/**
 * 🌱 Données de test FasoFree (environnement local / sandbox)
 *
 * - 1 Client (Awa) avec wallet crédité de 25 000 FCFA
 * - 1 Livreur (Issa) actif & en ligne avec wallet
 * - 1 Marque "Faso Délices" + 2 agences (multi-agences)
 * - 1 abonnement Boost Pro (1.5%) sur l'agence principale
 * - Quelques produits pour tester le catalogue
 *
 * Idempotent : ré-exécutable sans doublon (find-or-create par email).
 */
@Injectable()
export class SeedCommand {
  private readonly logger = new Logger(SeedCommand.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly businessesService: BusinessesService,
    private readonly brandsService: BrandsService,
    private readonly walletService: WalletService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  @Command({
    command: 'seed:test-data',
    describe:
      'Crée les données de test FasoFree (client, livreur, marque, agences)',
  })
  async seedTestData(): Promise<void> {
    console.log('\n🌱 ===== SEED FASOFREE : DONNÉES DE TEST =====');

    // 1. Utilisateurs -----------------------------------------------------
    const client = await this.findOrCreateUser(
      'test.client@fasofree.bf',
      AppUserRole.CLIENT,
      'Awa Ouédraogo',
      '+22670000001',
      { latitude: 12.3714, longitude: -1.5197 },
    );

    const driver = await this.findOrCreateUser(
      'test.driver@fasofree.bf',
      AppUserRole.DRIVER,
      'Issa Kaboré',
      '+22670000002',
      {
        latitude: 12.376,
        longitude: -1.517,
        isOnline: true,
        isAvailable: true,
      },
    );

    const merchantAdmin = await this.findOrCreateUser(
      'test.merchant@fasofree.bf',
      AppUserRole.BUSINESS_ADMIN,
      'Moussa Traoré',
      '+22670000003',
    );

    // 2. Marque & agences (multi-agences) ----------------------------------
    let brand = await this.brandRepository.findOne({
      where: { name: 'Faso Délices' },
    });
    if (!brand) {
      brand = await this.brandsService.create(
        {
          name: 'Faso Délices',
          description: 'Restaurant & livraison - Ouagadougou',
        },
        merchantAdmin.id,
      );
      console.log(`✅ Marque créée : ${brand.name} (${brand.id})`);
    } else {
      console.log(`ℹ️  Marque existante : ${brand.name}`);
    }

    const agence1 = await this.ensureBusiness(
      brand,
      merchantAdmin.id,
      'Faso Délices - Centre',
      "1200, Avenue Kwame N'Krumah, Ouagadougou",
      '+22670000004',
      12.3714,
      -1.5197,
    );
    const agence2 = await this.ensureBusiness(
      brand,
      merchantAdmin.id,
      'Faso Délices - Ouaga 2000',
      'Ouaga 2000, Ouagadougou',
      '+22670000005',
      12.42,
      -1.545,
    );

    // 3. Abonnement Pro (1.5%) sur l'agence principale ----------------------
    await this.ensureProSubscription(agence1.id);

    // 4. Wallet client : crédit de test 25 000 FCFA -------------------------
    await this.walletService.getOrCreateWallet(
      client.id,
      WalletUserRole.CUSTOMER,
    );
    const clientCredit = await this.walletService.creditWallet(
      client.id,
      WalletUserRole.CUSTOMER,
      25000,
      TransactionReason.TOPUP,
      'seed:test-data',
      'Crédit de test FasoFree (recharge simulant un dépôt Mobile Money)',
    );

    // 5. Wallet livreur : actif + petit solde -------------------------------
    await this.walletService.getOrCreateWallet(
      driver.id,
      WalletUserRole.DRIVER,
    );
    const driverCredit = await this.walletService.creditWallet(
      driver.id,
      WalletUserRole.DRIVER,
      1000,
      TransactionReason.TOPUP,
      'seed:test-data:driver',
      'Solde de test livreur (le Pass Journée 500 F sera débité à la 1ère course)',
    );

    // 6. Wallet marchand pré-créé (agence principale) + crédit de test --------
    //    (pour tester l'abonnement Pro payé par débit du portefeuille marchand)
    const merchantWallet = await this.walletService.getOrCreateWallet(
      agence1.id,
      WalletUserRole.MERCHANT,
    );
    const merchantCredit = await this.walletService.creditWallet(
      agence1.id,
      WalletUserRole.MERCHANT,
      10000,
      TransactionReason.TOPUP,
      'seed:test-data:merchant',
      'Crédit de test portefeuille marchand (pour l’abonnement Pro déductible)',
    );

    // 7. Produits -------------------------------------------------------------
    await this.ensureProducts(agence1.id);

    // 8. Récapitulatif ---------------------------------------------------------
    console.log(
      '\n===========================================================',
    );
    console.log('   🎯 COMPTES DE TEST (mot de passe : ' + SEED_PASSWORD + ')');
    console.log('===========================================================');
    console.log(`👤 CLIENT   : test.client@fasofree.bf   (ID: ${client.id})`);
    console.log(`   Wallet CUSTOMER : ${clientCredit.wallet.balance} FCFA`);
    console.log(`🛵 LIVREUR  : test.driver@fasofree.bf   (ID: ${driver.id})`);
    console.log(`   Wallet DRIVER   : ${driverCredit.wallet.balance} FCFA`);
    console.log(
      `🏪 MARCHAND : test.merchant@fasofree.bf (ID: ${merchantAdmin.id})`,
    );
    console.log(
      `   Wallet MERCHANT (agence 1) : ${merchantCredit.wallet.balance} FCFA`,
    );
    console.log(`🏷️ MARQUE   : ${brand.name} (ID: ${brand.id})`);
    console.log(`   Agence 1 : ${agence1.id}`);
    console.log(`   Agence 2 : ${agence2.id}`);
    console.log(
      '===========================================================\n',
    );
  }

  // ---------------------------------------------------------------- helpers
  private async findOrCreateUser(
    email: string,
    role: AppUserRole,
    fullName: string,
    phone: string,
    extra?: {
      latitude?: number;
      longitude?: number;
      isOnline?: boolean;
      isAvailable?: boolean;
    },
  ): Promise<User> {
    let user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Try to create user, if it fails due to duplicate phone, find by phone instead
      try {
        user = await this.usersService.create({
          email,
          password: SEED_PASSWORD,
          role,
          fullName,
          phone,
        });
        console.log(`✅ Utilisateur créé : ${email} (${role})`);
      } catch (error) {
        // If duplicate phone error, find existing user by phone
        if (error.message?.includes('duplicate key') || error?.message?.includes('already exists')) {
          const existingUser = await this.userRepository.findOne({ where: { phone } });
          if (existingUser) {
            user = existingUser;
            console.log(`ℹ️  Utilisateur existant (par téléphone) : ${phone} (${role})`);
            // Update password to known test password
            const bcrypt = require('bcrypt');
            const salt = await bcrypt.genSalt(10);
            user.passwordHash = await bcrypt.hash(SEED_PASSWORD, salt);
            await this.userRepository.save(user);
            console.log(`🔐 Mot de passe réinitialisé à : ${SEED_PASSWORD}`);
          } else {
            throw new Error(`Utilisateur avec téléphone ${phone} non trouvé`);
          }
        } else {
          throw error;
        }
      }
    } else {
      console.log(`ℹ️  Utilisateur existant : ${email}`);
    }

    if (extra) {
      await this.userRepository.update(user.id, extra);
    }
    return user;
  }

  private async ensureBusiness(
    brand: Brand,
    ownerId: string,
    name: string,
    address: string,
    phone: string,
    latitude: number,
    longitude: number,
  ): Promise<Business> {
    let business = await this.businessRepository.findOne({ where: { name } });
    if (!business) {
      business = await this.businessesService.create(
        {
          name,
          address,
          phone,
          latitude,
          longitude,
          brandId: brand.id,
        },
        ownerId,
      );
      console.log(`✅ Agence créée : ${name} (${business.id})`);
    } else {
      if (business.brandId !== brand.id) {
        await this.businessRepository.update(business.id, {
          brandId: brand.id,
        });
      }
      console.log(`ℹ️  Agence existante : ${name}`);
    }
    return business;
  }

  private async ensureProSubscription(businessId: string): Promise<void> {
    const existing = await this.subscriptionRepository.findOne({
      where: {
        subjectType: SubscriptionSubjectType.MERCHANT,
        subjectId: businessId,
        plan: SubscriptionPlan.PRO,
        isActive: true,
      },
    });
    if (existing) {
      console.log(
        `ℹ️  Abonnement Pro déjà actif sur l'agence ${businessId}`,
      );
      return;
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    await this.subscriptionRepository.save(
      this.subscriptionRepository.create({
        subjectType: SubscriptionSubjectType.MERCHANT,
        subjectId: businessId,
        plan: SubscriptionPlan.PRO,
        startDate,
        endDate,
        isActive: true,
        autoRenew: true,
      }),
    );
    console.log(
      `✅ Abonnement Pro (5000 FCFA/mois, commission 1.5%) activé sur ${businessId}`,
    );
  }

  private async ensureProducts(businessId: string): Promise<void> {
    const catalog = [
      { name: 'Poulet Braisé + Riz', price: 3500, category: 'PLAT' },
      { name: 'Riz Sauce Arachide', price: 1500, category: 'PLAT' },
      { name: 'Brochettes de Bœuf (x5)', price: 1000, category: 'GRILLADE' },
      { name: 'Jus de Bissap (50cl)', price: 500, category: 'BOISSON' },
      { name: 'Eau Minérale 1.5L', price: 400, category: 'BOISSON' },
    ];

    for (const item of catalog) {
      const existing = await this.productRepository.findOne({
        where: { businessId, name: item.name },
      });
      if (existing) continue;
      await this.productRepository.save(
        this.productRepository.create({
          businessId,
          name: item.name,
          price: item.price,
          category: item.category,
          isAvailable: true,
          stockQuantity: 100,
        }),
      );
    }
    console.log(
      `✅ Catalogue (${catalog.length} produits) rattaché à ${businessId}`,
    );
  }
}
