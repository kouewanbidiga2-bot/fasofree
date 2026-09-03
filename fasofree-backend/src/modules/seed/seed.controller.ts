import {
  Controller,
  Post,
  UseGuards,
  Request as NestRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { Business } from '../businesses/entities/business.entity';
import { Product } from '../products/entities/product.entity';
import { Brand } from '../brands/entities/brand.entity';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';

type RequestWithUser = ExpressRequest & {
  user?: { userId?: string; role?: UserRole };
};

@ApiTags('Seed')
@Controller('seed')
export class SeedController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
  ) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('chitir-chicken')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Seed Chitir Chicken (brand + 3 branches + 10 products)' })
  async seedChitirChicken(@NestRequest() req: RequestWithUser) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Utilisateur non authentifié');

    // 1. Find or create admin user
    let admin = await this.userRepository.findOne({
      where: { email: 'admin@chitirchicken.bf' },
    });
    if (!admin) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('Test@12345', salt);
      admin = this.userRepository.create({
        email: 'admin@chitirchicken.bf',
        passwordHash,
        passwordPlain: 'Test@12345',
        fullName: 'Chitir Chicken Admin',
        phone: '+22677000001',
        role: UserRole.BUSINESS_ADMIN,
        referralCode: `CC-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      });
      admin = await this.userRepository.save(admin);
    }

    // 2. Find or create brand
    let brand = await this.brandRepository.findOne({
      where: { name: 'Chitir Chicken' },
    });
    if (!brand) {
      brand = this.brandRepository.create({
        name: 'Chitir Chicken',
        description: 'Poulet grillé & frit - Spécialiste du poulet à Ouaga',
        logoUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop',
        ownerId: admin.id,
      });
      brand = await this.brandRepository.save(brand);
    }

    // 3. Create branches
    const branches = [
      {
        name: 'Chitir Chicken - Kamboinsin',
        address: 'Kamboinsin, Ouagadougou',
        phone: '+22677000011',
        latitude: 12.3650,
        longitude: -1.5200,
      },
      {
        name: 'Chitir Chicken - Kamsonghin',
        address: 'Kamsonghin, Ouagadougou',
        phone: '+22677000012',
        latitude: 12.3800,
        longitude: -1.5100,
      },
      {
        name: 'Chitir Chicken - Ouaga 2000',
        address: 'Ouaga 2000, Ouagadougou',
        phone: '+22677000013',
        latitude: 12.2850,
        longitude: -1.4918,
      },
    ];

    const savedBranches: Business[] = [];
    for (const b of branches) {
      let biz = await this.businessRepository.findOne({ where: { name: b.name } });
      if (!biz) {
        biz = this.businessRepository.create({
          name: b.name,
          address: b.address,
          phone: b.phone,
          ownerId: admin.id,
          brandId: brand.id,
          category: 'RESTAURANT' as any,
          latitude: b.latitude,
          longitude: b.longitude,
          enableDelivery: true,
          enablePickup: true,
          isOpen: true,
          location: { type: 'Point', coordinates: [b.longitude, b.latitude] },
        });
        biz = await this.businessRepository.save(biz);
      } else if (biz.brandId !== brand.id) {
        await this.businessRepository.update(biz.id, { brandId: brand.id });
      }
      savedBranches.push(biz);
    }

    // 4. Create products on first branch
    const sharedMenu = [
      { name: 'Chitir Chicken (Poulet Entier)', price: 5500, category: 'Poulet', imageUrl: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600' },
      { name: 'Chitir Chicken (Demi)', price: 3000, category: 'Poulet', imageUrl: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600' },
      { name: 'Poulet Braisé + Riz', price: 3500, category: 'Plats', imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600' },
      { name: 'Poulet Frit (6 morceaux)', price: 4500, category: 'Poulet Frit', imageUrl: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600' },
      { name: 'Wings (12)', price: 4000, category: 'Poulet Frit', imageUrl: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600' },
      { name: 'Tacos Poulet', price: 3000, category: 'Sandwiches', imageUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600' },
      { name: 'Salade Poulet Grillé', price: 2500, category: 'Salades', imageUrl: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=600' },
      { name: 'Frites', price: 1000, category: 'Accompagnements', imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600' },
      { name: 'Jus de Baobab', price: 500, category: 'Boissons', imageUrl: 'https://images.unsplash.com/photo-1566633806327-68e152aaf26d?w=600' },
      { name: 'Eau Minérale', price: 300, category: 'Boissons', imageUrl: 'https://images.unsplash.com/photo-1523362628745-0c100950e180?w=600' },
    ];

    const mainBranch = savedBranches[0];
    let productsCreated = 0;
    for (const p of sharedMenu) {
      const existing = await this.productRepository.findOne({
        where: { businessId: mainBranch.id, name: p.name },
      });
      if (!existing) {
        await this.productRepository.save(
          this.productRepository.create({
            businessId: mainBranch.id,
            name: p.name,
            price: p.price,
            category: p.category,
            imageUrl: p.imageUrl,
            isAvailable: true,
            stockQuantity: 100,
          }),
        );
        productsCreated++;
      }
    }

    return {
      success: true,
      brand: { id: brand.id, name: brand.name },
      branches: savedBranches.map((b) => ({ id: b.id, name: b.name })),
      productsCreated,
      message: `Chitir Chicken seed terminé : ${savedBranches.length} agences, ${productsCreated} produits créés`,
    };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('test-data')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Seed test data (client, driver, Faso Délices brand + products)' })
  async seedTestData(@NestRequest() req: RequestWithUser) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Utilisateur non authentifié');

    // Create test client
    let client = await this.userRepository.findOne({
      where: { email: 'test.client@fasofree.bf' },
    });
    if (!client) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('Test@12345', salt);
      client = this.userRepository.create({
        email: 'test.client@fasofree.bf',
        passwordHash,
        passwordPlain: 'Test@12345',
        fullName: 'Awa Ouédraogo',
        phone: '+22670000001',
        role: UserRole.CLIENT,
        referralCode: `AWA-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      });
      client = await this.userRepository.save(client);
    }

    // Create test driver
    let driver = await this.userRepository.findOne({
      where: { email: 'test.driver@fasofree.bf' },
    });
    if (!driver) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('Test@12345', salt);
      driver = this.userRepository.create({
        email: 'test.driver@fasofree.bf',
        passwordHash,
        passwordPlain: 'Test@12345',
        fullName: 'Issa Kaboré',
        phone: '+22670000002',
        role: UserRole.DRIVER,
        isOnline: true,
        isAvailable: true,
        latitude: 12.376,
        longitude: -1.517,
        referralCode: `ISSA-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      });
      driver = await this.userRepository.save(driver);
    }

    // Create Faso Délices brand + branches
    let brand = await this.brandRepository.findOne({
      where: { name: 'Faso Délices' },
    });
    if (!brand) {
      let merchantAdmin = await this.userRepository.findOne({
        where: { email: 'test.merchant@fasofree.bf' },
      });
      if (!merchantAdmin) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('Test@12345', salt);
        merchantAdmin = this.userRepository.create({
          email: 'test.merchant@fasofree.bf',
          passwordHash,
          passwordPlain: 'Test@12345',
          fullName: 'Moussa Traoré',
          phone: '+22670000003',
          role: UserRole.BUSINESS_ADMIN,
          referralCode: `MOU-${Date.now().toString(36).slice(-4).toUpperCase()}`,
        });
        merchantAdmin = await this.userRepository.save(merchantAdmin);
      }

      brand = this.brandRepository.create({
        name: 'Faso Délices',
        description: 'Restaurant & livraison - Ouagadougou',
        ownerId: merchantAdmin.id,
      });
      brand = await this.brandRepository.save(brand);

      // Create branches
      const agence1 = this.businessRepository.create({
        name: 'Faso Délices - Centre',
        address: "1200, Avenue Kwame N'Krumah, Ouagadougou",
        phone: '+22670000004',
        ownerId: merchantAdmin.id,
        brandId: brand.id,
        category: 'RESTAURANT' as any,
        latitude: 12.3714,
        longitude: -1.5197,
        enableDelivery: true,
        enablePickup: true,
        isOpen: true,
        location: { type: 'Point', coordinates: [-1.5197, 12.3714] },
      });
      const savedAgence1 = await this.businessRepository.save(agence1);

      // Products on main branch
      const products = [
        { name: 'Poulet Braisé + Riz', price: 3500, category: 'PLAT' },
        { name: 'Riz Sauce Arachide', price: 1500, category: 'PLAT' },
        { name: 'Brochettes de Bœuf (x5)', price: 1000, category: 'GRILLADE' },
        { name: 'Jus de Bissap (50cl)', price: 500, category: 'BOISSON' },
        { name: 'Eau Minérale 1.5L', price: 400, category: 'BOISSON' },
      ];
      for (const p of products) {
        await this.productRepository.save(
          this.productRepository.create({
            businessId: savedAgence1.id,
            name: p.name,
            price: p.price,
            category: p.category,
            isAvailable: true,
            stockQuantity: 100,
          }),
        );
      }
    }

    return {
      success: true,
      message: 'Données de test créées avec succès',
      accounts: {
        client: { email: 'test.client@fasofree.bf', password: 'Test@12345' },
        driver: { email: 'test.driver@fasofree.bf', password: 'Test@12345' },
      },
    };
  }
}
