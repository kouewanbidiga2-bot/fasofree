import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Business } from '../businesses/entities/business.entity';
import { UserRole } from '../users/entities/user-role.enum';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  // 🛍️ 1. Créer un produit
  async create(dto: any, userId: string, role: UserRole): Promise<Product> {
    await this.assertBusinessOwnership(dto.businessId, userId, role);
    const product = this.productRepository.create({
      name: dto.name,
      description: dto.description,
      price: dto.price,
      imageUrl: dto.imageUrl,
      category: dto.category,
      isAvailable: dto.isAvailable,
      businessId: dto.businessId,
    });
    return this.productRepository.save(product);
  }

  // 📋 2. Lister tous les produits
  async findAll(): Promise<Product[]> {
    return this.productRepository.find({
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  // 🔍 3. Trouver un produit spécifique
  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Produit #${id} introuvable`);
    return product;
  }

  // 🏪 4. Lister les produits d'un commerce spécifique
  async findByBusiness(businessId: string): Promise<Product[]> {
    return this.productRepository.find({
      where: { businessId },
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  // 🔄 5. Mettre à jour un produit
  async update(
    id: string,
    dto: any,
    userId: string,
    role: UserRole,
  ): Promise<Product> {
    const product = await this.findOne(id);
    await this.assertBusinessOwnership(product.businessId, userId, role);
    // Fusionne les nouvelles données avec le produit existant
    Object.assign(product, dto);
    return this.productRepository.save(product);
  }

  // 👁️ 6. Activer/Désactiver un produit (Rupture de stock)
  async toggleAvailability(
    id: string,
    userId: string,
    role: UserRole,
  ): Promise<Product> {
    const product = await this.findOne(id);
    await this.assertBusinessOwnership(product.businessId, userId, role);
    product.isAvailable = !product.isAvailable;
    return this.productRepository.save(product);
  }

  // 🗑️ 7. Supprimer un produit
  async remove(id: string, userId: string, role: UserRole): Promise<void> {
    const product = await this.findOne(id);
    await this.assertBusinessOwnership(product.businessId, userId, role);
    await this.productRepository.remove(product);
  }

  private async assertBusinessOwnership(
    businessId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    if (role === UserRole.SUPER_ADMIN) return;
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Commerce introuvable');
    if (business.ownerId !== userId)
      throw new ForbiddenException(
        'Vous ne pouvez pas gérer les produits de ce commerce',
      );
  }
}
