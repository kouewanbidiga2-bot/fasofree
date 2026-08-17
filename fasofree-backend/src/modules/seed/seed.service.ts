import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { Business, BusinessCategory } from '../businesses/entities/business.entity';
import { Product } from '../products/entities/product.entity';

const SEED_MERCHANT = {
  fullName: 'Ibrahim Ouédraogo',
  email: 'ibrahim@fasofree.bf',
  phone: '+22670123456',
  password: 'Merchant@123',
};

const SEED_CLIENT = {
  fullName: 'Aminata Compaoré',
  email: 'aminata@fasofree.bf',
  phone: '+22671234567',
  password: 'Client@12345',
};

const SEED_RESTAURANT = {
  name: 'Chez Cesar',
  address: 'Patte d\'Oie, Ouagadougou',
  phone: '+22670207831',
  category: BusinessCategory.RESTAURANT,
  latitude: 12.3665,
  longitude: -1.4807,
  enableDelivery: true,
  enablePickup: true,
  enableDineIn: false,
  isOpen: true,
};

const SEED_RESTAURANT_2 = {
  name: 'Maquis Gusto',
  address: 'Zone Ouaga 2000, Ouagadougou',
  phone: '+22675654321',
  category: BusinessCategory.RESTAURANT,
  latitude: 12.3527,
  longitude: -1.4664,
  enableDelivery: true,
  enablePickup: true,
  enableDineIn: true,
  isOpen: true,
};

const SEED_RESTAURANT_3 = {
  name: 'BelChiken',
  address: 'Karpala, Ouagadougou',
  phone: '+22678876543',
  category: BusinessCategory.RESTAURANT,
  latitude: 12.3807,
  longitude: -1.5037,
  enableDelivery: true,
  enablePickup: true,
  enableDineIn: false,
  isOpen: true,
};

const SEED_PRODUCTS_CESAR = [
  { name: 'Cesar Burger', description: 'Double steak, fromage cheddar, bacon, sauce Cesar', price: 4000, category: 'Burgers', isAvailable: true, stockQuantity: 50 },
  { name: 'Chicken Sandwich', description: 'Filet de poulet grillé, mayonnaise, laitue, tomate', price: 3000, category: 'Sandwiches', isAvailable: true, stockQuantity: 40 },
  { name: 'Plat du Jour', description: 'Riz au gras + poulet braisé + légumes sautés', price: 3500, category: 'Plats', isAvailable: true, stockQuantity: 30 },
  { name: 'Salade Cesar', description: 'Laitue romaine, poulet grillé, croûtons, parmesan', price: 4000, category: 'Salades', isAvailable: true, stockQuantity: 20 },
  { name: 'Tacos Poulet', description: 'Tacos mexicain au poulet épicé, guacamole', price: 3000, category: 'Sandwiches', isAvailable: true, stockQuantity: 35 },
  { name: 'Poulet Frit (6 morceaux)', description: 'Poulet mariné et frit, servis avec frites', price: 5500, category: 'Poulet Frit', isAvailable: true, stockQuantity: 25 },
  { name: 'Jus de Baobab', description: 'Jus de baobab frais naturel', price: 500, category: 'Boissons', isAvailable: true, stockQuantity: 100 },
  { name: 'Dègue Douce', description: 'Dègue à la confiture de lait et mil', price: 800, category: 'Desserts', isAvailable: true, stockQuantity: 30 },
];

const SEED_PRODUCTS_GUSTO = [
  { name: 'Brochettes de Boeuf', description: 'Brochettes de boeuf grillées au charbon, oignons frits', price: 6000, category: 'Grillades', isAvailable: true, stockQuantity: 30 },
  { name: 'Poisson Braisé', description: 'Capitaine entier braisé, sauce tomate pimentée', price: 7000, category: 'Grillades', isAvailable: true, stockQuantity: 15 },
  { name: 'Riz Cantonais', description: 'Riz sauté aux légumes, crevettes, poulet, oeuf', price: 5000, category: 'Plats Chauds', isAvailable: true, stockQuantity: 25 },
  { name: 'Poulet Braisé', description: 'Demi-poulet braisé, yassa d\'oignons, riz blanc', price: 4500, category: 'Plats Chauds', isAvailable: true, stockQuantity: 20 },
  { name: 'Flag rouge', description: 'Biéro Flag 65cl bien fraîche', price: 1000, category: 'Boissons', isAvailable: true, stockQuantity: 200 },
  { name: 'Dègue au Mil', description: 'Dègue traditionnelle au mil et à la confiture', price: 700, category: 'Desserts', isAvailable: true, stockQuantity: 40 },
];

const SEED_PRODUCTS_BELCHIKEN = [
  { name: 'Poulet Frit Spécial (8 morceaux)', description: 'Poulet mariné 24h, frit croustillant, sauce piquante', price: 7500, category: 'Poulet Frit', isAvailable: true, stockQuantity: 30 },
  { name: 'Wings (12)', description: 'Ailes de poulet croustillantes, sauce BBQ ou piment', price: 4500, category: 'Poulet Frit', isAvailable: true, stockQuantity: 40 },
  { name: 'Burger Poulet Crunch', description: 'Escalope de poulet panée, laitue, tomate, sauce maison', price: 3500, category: 'Burgers', isAvailable: true, stockQuantity: 35 },
  { name: 'Frites & Poulet', description: 'Menu composé : frites de pomme de terre + 4 morceaux poulet', price: 4000, category: 'Menus', isAvailable: true, stockQuantity: 25 },
  { name: 'Boisson Isotopique', description: 'Boisson isotonique citron 50cl', price: 500, category: 'Boissons', isAvailable: true, stockQuantity: 80 },
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedMerchantUser();
    await this.seedClientUser();
    await this.seedRestaurants();
  }

  private async seedMerchantUser(): Promise<void> {
    const existing = await this.userRepository.findOne({ where: { email: SEED_MERCHANT.email } });
    if (existing) return;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(SEED_MERCHANT.password, salt);

    const user = this.userRepository.create({
      fullName: SEED_MERCHANT.fullName,
      email: SEED_MERCHANT.email,
      phone: SEED_MERCHANT.phone,
      passwordHash,
      role: UserRole.BUSINESS_ADMIN,
      isActive: true,
      referralCode: `IBRAHIM-${Date.now().toString(36).slice(-4).toUpperCase()}`,
    });
    await this.userRepository.save(user);
    this.logger.log(`[Seed] Compte marchand créé : ${SEED_MERCHANT.email} / ${SEED_MERCHANT.password}`);
  }

  private async seedClientUser(): Promise<void> {
    const existing = await this.userRepository.findOne({ where: { email: SEED_CLIENT.email } });
    if (existing) return;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(SEED_CLIENT.password, salt);

    const user = this.userRepository.create({
      fullName: SEED_CLIENT.fullName,
      email: SEED_CLIENT.email,
      phone: SEED_CLIENT.phone,
      passwordHash,
      role: UserRole.CLIENT,
      isActive: true,
      referralCode: `AMINATA-${Date.now().toString(36).slice(-4).toUpperCase()}`,
    });
    await this.userRepository.save(user);
    this.logger.log(`[Seed] Compte client créé : ${SEED_CLIENT.email} / ${SEED_CLIENT.password}`);
  }

  private async seedRestaurants(): Promise<void> {
    const existingMerchant = await this.userRepository.findOne({
      where: { email: SEED_MERCHANT.email },
    });
    if (!existingMerchant) return;

    const ownerId = existingMerchant.id;

    const restaurants = [
      { ...SEED_RESTAURANT, products: SEED_PRODUCTS_CESAR },
      { ...SEED_RESTAURANT_2, products: SEED_PRODUCTS_GUSTO },
      { ...SEED_RESTAURANT_3, products: SEED_PRODUCTS_BELCHIKEN },
    ];

    for (const r of restaurants) {
      const existingBusiness = await this.businessRepository.findOne({
        where: { name: r.name },
      });
      if (existingBusiness) continue;

      const business = this.businessRepository.create({
        name: r.name,
        address: r.address,
        phone: r.phone,
        ownerId,
        category: r.category,
        enableDelivery: r.enableDelivery,
        enablePickup: r.enablePickup,
        enableDineIn: r.enableDineIn,
        isOpen: r.isOpen,
        latitude: r.latitude,
        longitude: r.longitude,
        location: {
          type: 'Point',
          coordinates: [r.longitude, r.latitude],
        },
      });
      const saved = await this.businessRepository.save(business);

      for (const p of r.products) {
        const product = this.productRepository.create({
          businessId: saved.id,
          name: p.name,
          description: p.description,
          price: p.price,
          category: p.category,
          isAvailable: p.isAvailable,
          trackStock: true,
          stockQuantity: p.stockQuantity,
        });
        await this.productRepository.save(product);
      }

      this.logger.log(`[Seed] Restaurant "${r.name}" créé avec ${r.products.length} produits`);
    }
  }
}
