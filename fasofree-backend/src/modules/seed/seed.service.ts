import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import {
  Business,
  BusinessCategory,
} from '../businesses/entities/business.entity';
import { Product } from '../products/entities/product.entity';

const SALT_ROUNDS = 10;

const SEED_MERCHANTS = [
  {
    fullName: 'Cesar Ouédraogo',
    email: 'cesar@fasofree.bf',
    phone: '+22670111111',
    password: 'Merchant@12345',
    restaurant: {
      name: 'Chez Cesar',
      address: "Patte d'Oie, Ouagadougou",
      phone: '+22670207831',
      category: BusinessCategory.RESTAURANT,
      latitude: 12.3665,
      longitude: -1.4807,
      enableDelivery: true,
      enablePickup: true,
      enableDineIn: false,
      isOpen: true,
      logo: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=400&fit=crop',
      coverImage:
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop',
    },
    products: [
      {
        name: 'Cesar Burger',
        description:
          'Double steak, fromage cheddar, bacon, sauce Cesar',
        price: 4000,
        category: 'Burgers',
        imageUrl:
          'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=600',
        stockQuantity: 50,
      },
      {
        name: 'Chicken Sandwich',
        description:
          'Filet de poulet grillé, mayonnaise, laitue, tomate',
        price: 3000,
        category: 'Sandwiches',
        imageUrl:
          'https://images.unsplash.com/photo-1521390188846-e2a3a97453a0?w=600',
        stockQuantity: 40,
      },
      {
        name: 'Plat du Jour',
        description:
          'Riz au gras + poulet braisé + légumes sautés',
        price: 3500,
        category: 'Plats',
        imageUrl:
          'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600',
        stockQuantity: 30,
      },
      {
        name: 'Salade Cesar',
        description:
          'Laitue romaine, poulet grillé, croûtons, parmesan',
        price: 4000,
        category: 'Salades',
        imageUrl:
          'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=600',
        stockQuantity: 20,
      },
      {
        name: 'Tacos Poulet',
        description: 'Tacos mexicain au poulet épicé, guacamole',
        price: 3000,
        category: 'Sandwiches',
        imageUrl:
          'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600',
        stockQuantity: 35,
      },
      {
        name: 'Poulet Frit (6 morceaux)',
        description: 'Poulet mariné et frit, servis avec frites',
        price: 5500,
        category: 'Poulet Frit',
        imageUrl:
          'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600',
        stockQuantity: 25,
      },
      {
        name: 'Jus de Baobab',
        description: 'Jus de baobab frais naturel',
        price: 500,
        category: 'Boissons',
        imageUrl:
          'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=600',
        stockQuantity: 100,
      },
      {
        name: 'Dègue Douce',
        description: 'Dègue à la confiture de lait et mil',
        price: 800,
        category: 'Desserts',
        imageUrl:
          'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600',
        stockQuantity: 30,
      },
    ],
  },
  {
    fullName: 'Gusto Bambara',
    email: 'gusto@fasofree.bf',
    phone: '+22675654321',
    password: 'Merchant@12345',
    restaurant: {
      name: 'Gusto',
      address: 'Zone Ouaga 2000, Ouagadougou',
      phone: '+22675654321',
      category: BusinessCategory.RESTAURANT,
      latitude: 12.3527,
      longitude: -1.4664,
      enableDelivery: true,
      enablePickup: true,
      enableDineIn: true,
      isOpen: true,
      logo: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop',
      coverImage:
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&h=400&fit=crop',
    },
    products: [
      {
        name: 'Brochettes de Boeuf',
        description:
          'Brochettes de boeuf grillées au charbon, oignons frits',
        price: 6000,
        category: 'Grillades',
        imageUrl:
          'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600',
        stockQuantity: 30,
      },
      {
        name: 'Poisson Braisé',
        description:
          'Capitaine entier braisé, sauce tomate pimentée',
        price: 7000,
        category: 'Grillades',
        imageUrl:
          'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600',
        stockQuantity: 15,
      },
      {
        name: 'Riz Cantonais',
        description:
          'Riz sauté aux légumes, crevettes, poulet, oeuf',
        price: 5000,
        category: 'Plats Chauds',
        imageUrl:
          'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600',
        stockQuantity: 25,
      },
      {
        name: 'Poulet Braisé',
        description:
          "Demi-poulet braisé, yassa d'oignons, riz blanc",
        price: 4500,
        category: 'Plats Chauds',
        imageUrl:
          'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600',
        stockQuantity: 20,
      },
      {
        name: 'Flag Rouge',
        description: 'Biéro Flag 65cl bien fraîche',
        price: 1000,
        category: 'Boissons',
        imageUrl:
          'https://images.unsplash.com/photo-1566633806327-68e152aaf26d?w=600',
        stockQuantity: 200,
      },
      {
        name: 'Dègue au Mil',
        description:
          'Dègue traditionnelle au mil et à la confiture',
        price: 700,
        category: 'Desserts',
        imageUrl:
          'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600',
        stockQuantity: 40,
      },
    ],
  },
  {
    fullName: 'Belchiken Traoré',
    email: 'belchiken@fasofree.bf',
    phone: '+22678876543',
    password: 'Merchant@12345',
    restaurant: {
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
      logo: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop',
      coverImage:
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=400&fit=crop',
    },
    products: [
      {
        name: 'Poulet Frit Spécial (8 morceaux)',
        description:
          'Poulet mariné 24h, frit croustillant, sauce piquante',
        price: 7500,
        category: 'Poulet Frit',
        imageUrl:
          'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600',
        stockQuantity: 30,
      },
      {
        name: 'Wings (12)',
        description:
          'Ailes de poulet croustillantes, sauce BBQ ou piment',
        price: 4500,
        category: 'Poulet Frit',
        imageUrl:
          'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600',
        stockQuantity: 40,
      },
      {
        name: 'Burger Poulet Crunch',
        description:
          'Escalope de poulet panée, laitue, tomate, sauce maison',
        price: 3500,
        category: 'Burgers',
        imageUrl:
          'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
        stockQuantity: 35,
      },
      {
        name: 'Frites & Poulet',
        description:
          'Menu composé : frites de pomme de terre + 4 morceaux poulet',
        price: 4000,
        category: 'Menus',
        imageUrl:
          'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600',
        stockQuantity: 25,
      },
      {
        name: 'Boisson Isotopique',
        description: 'Boisson isotonique citron 50cl',
        price: 500,
        category: 'Boissons',
        imageUrl:
          'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=600',
        stockQuantity: 80,
      },
    ],
  },
];

const SEED_CLIENT = {
  fullName: 'Aminata Compaoré',
  email: 'aminata@fasofree.bf',
  phone: '+22671234567',
  password: 'Client@12345',
};

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
    await this.seedClientUser();
    await this.seedMerchantsAndRestaurants();
  }

  private async ensureUser(
    data: { fullName: string; email: string; phone: string; password: string },
    role: UserRole,
  ): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: data.email },
    });
    if (existing) return existing;

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const user = this.userRepository.create({
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role,
      isActive: true,
      referralCode: `${data.fullName.split(' ')[0].toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
    });
    const saved = await this.userRepository.save(user);
    this.logger.log(`[Seed] Compte ${role} créé : ${data.email}`);
    return saved;
  }

  private async seedClientUser(): Promise<void> {
    await this.ensureUser(SEED_CLIENT, UserRole.CLIENT);
  }

  private async seedMerchantsAndRestaurants(): Promise<void> {
    for (const m of SEED_MERCHANTS) {
      const merchant = await this.ensureUser(m, UserRole.BUSINESS_ADMIN);

      const existingBiz = await this.businessRepository.findOne({
        where: { name: m.restaurant.name },
      });
      if (existingBiz) {
        // Update image fields if they are missing
        if (!existingBiz.logo || !existingBiz.coverImage) {
          await this.businessRepository.update(existingBiz.id, {
            logo: m.restaurant.logo,
            coverImage: m.restaurant.coverImage,
          });
        }
        this.logger.log(
          `[Seed] Restaurant "${m.restaurant.name}" existe déjà — skip`,
        );
        continue;
      }

      const business = this.businessRepository.create({
        name: m.restaurant.name,
        address: m.restaurant.address,
        phone: m.restaurant.phone,
        ownerId: merchant.id,
        category: m.restaurant.category,
        enableDelivery: m.restaurant.enableDelivery,
        enablePickup: m.restaurant.enablePickup,
        enableDineIn: m.restaurant.enableDineIn,
        isOpen: m.restaurant.isOpen,
        latitude: m.restaurant.latitude,
        longitude: m.restaurant.longitude,
        logo: m.restaurant.logo,
        coverImage: m.restaurant.coverImage,
        location: {
          type: 'Point',
          coordinates: [m.restaurant.longitude, m.restaurant.latitude],
        },
      });
      const savedBiz = await this.businessRepository.save(business);

      for (const p of m.products) {
        const existingProduct = await this.productRepository.findOne({
          where: { businessId: savedBiz.id, name: p.name },
        });
        if (existingProduct) {
          if (!existingProduct.imageUrl) {
            await this.productRepository.update(existingProduct.id, {
              imageUrl: p.imageUrl,
            });
          }
          continue;
        }

        const product = this.productRepository.create({
          businessId: savedBiz.id,
          name: p.name,
          description: p.description,
          price: p.price,
          category: p.category,
          imageUrl: p.imageUrl,
          isAvailable: true,
          trackStock: true,
          stockQuantity: p.stockQuantity,
        });
        await this.productRepository.save(product);
      }

      this.logger.log(
        `[Seed] Restaurant "${m.restaurant.name}" créé avec ${m.products.length} produits (${m.email})`,
      );
    }
  }
}
