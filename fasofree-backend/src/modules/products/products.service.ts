import {
  ConflictException,
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
    const suppliedSku = dto.sku?.trim();
    const MAX_ATTEMPTS = 4; // 1 tentative initiale + 3 régénérations de matricule
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        // 🔖 Matricule automatique : si le restaurateur n'en saisit pas, la
        // plateforme attribue un SKU unique — la gestion du stock ne le
        // dérange jamais (pas de saisie obligatoire).
        const sku =
          suppliedSku ||
          (await this.generateUniqueSku(dto.businessId, dto.category, attempt));
        const product = this.productRepository.create({
          name: dto.name,
          description: dto.description,
          price: dto.price,
          imageUrl: dto.imageUrl,
          category: dto.category,
          type: dto.type,
          sku,
          isAvailable: dto.isAvailable,
          trackStock: dto.trackInventory ?? true,
          stockQuantity: dto.stockQuantity ?? 0,
          minStockAlert: dto.minStockAlert,
          businessId: dto.businessId,
        });
        return await this.productRepository.save(product);
      } catch (err: any) {
        // ⚔️ Concurrence : deux créations simultanées ont produit le même
        // matricule auto-généré → on régénère (candidat différent à chaque
        // essai) et on retente, appuyé par l'index unique
        // "IDX_products_sku_unique" sur "sku". Un SKU fourni par le
        // restaurateur n'est jamais réécrit : l'erreur remonte.
        const isSkuConflict = err?.driverError?.code === '23505';
        if (isSkuConflict && !suppliedSku) continue;
        throw err;
      }
    }
    throw new ConflictException(
      'Matricule produit : génération impossible, veuillez réessayer',
    );
  }

  // 📋 2. Lister tous les produits
  async findAll(): Promise<Product[]> {
    return this.productRepository.find({
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  // ⚠️ 2bis. Produits en stock bas (sous minStockAlert)
  async findLowStock(businessId: string): Promise<Product[]> {
    const products = await this.productRepository.find({
      where: { businessId },
      order: { stockQuantity: 'ASC' },
    });
    return products.filter(
      (p) =>
        p.trackStock &&
        p.minStockAlert != null &&
        p.stockQuantity <= p.minStockAlert,
    );
  }

  // 🔍 3. Trouver un produit spécifique
  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Produit #${id} introuvable`);
    return product;
  }

  // 🏪 4. Lister les produits d'un commerce spécifique
  async findByBusiness(businessId: string, category?: string): Promise<Product[]> {
    const where: any = { businessId };
    if (category) {
      where.category = category;
    }
    return this.productRepository.find({
      where,
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
    // 🔖 Garde matricule : un SKU fourni doit rester unique → 409 clair au
    // lieu d'une violation DB opaque (500). Un matricule existant ne peut
    // JAMAIS être effacé (null / chaîne vide → préservé) : l'auto-génération
    // n'est pas relancée et le produit ne redevient pas "sans matricule".
    let nextSku = product.sku;
    if (typeof dto.sku === 'string') {
      const trimmed = dto.sku.trim();
      if (trimmed && trimmed !== product.sku) {
        const duplicate = await this.productRepository.findOne({
          where: { sku: trimmed },
        });
        if (duplicate && duplicate.id !== id) {
          throw new ConflictException(
            'Ce matricule est déjà utilisé par un autre produit',
          );
        }
      }
      nextSku = trimmed || product.sku;
    }
    if (dto.trackInventory !== undefined) {
      product.trackStock = dto.trackInventory;
    }
    // Object.assign : { sku: nextSku } (source la plus récente) l'emporte sur
    // dto.sku, quel que soit sa valeur (undefined, null, chaîne vide).
    Object.assign(product, dto, { sku: nextSku });
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

  // 📦 8. Mettre à jour le stock d'un produit
  async updateStock(
    id: string,
    quantity: number,
    reason: string,
    userId: string,
    role: UserRole,
  ): Promise<Product> {
    const product = await this.findOne(id);
    await this.assertBusinessOwnership(product.businessId, userId, role);
    product.stockQuantity = quantity;
    return this.productRepository.save(product);
  }

  // 🏷️ 9. Générer un SKU automatiquement
  generateSku(businessId: string, productName: string, category?: string): string {
    // Aperçu ASCII uniquement (export CSV / étiquettes) — le format
    // canonique stocké est FF-… produit par generateUniqueSku.
    const prefix = (category?.trim() || 'GEN').substring(0, 3).toUpperCase();
    const namePart = productName
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 5)
      .toUpperCase();
    const businessPart = businessId.substring(0, 4).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    return `${prefix}-${namePart}-${businessPart}-${timestamp}`;
  }

  // 🔖 9bis. Matricule unique garanti — format lisible et stable :
  //   FF-<catégorie>-<commerce>-<numéro>  (ex. FF-GÉN-CAFEAB12-0001)
  // Parcourt le prochain numéro disponible (aucun risque de doublon,
  // même après suppression/recréation de produits). `attempt` décale le
  // candidat à chaque essai lors d'un conflit de concurrence (23505).
  private async generateUniqueSku(
    businessId: string,
    category?: string,
    attempt = 0,
  ): Promise<string> {
    const cat = (category ?? '').toString().trim() || 'GÉNÉRAL';
    const prefix = `FF-${cat.substring(0, 3).toUpperCase()}-${businessId
      .replace(/-/g, '')
      .substring(0, 8)
      .toUpperCase()}`;
    let n = (await this.productRepository.count({ where: { businessId } })) + attempt;
    for (let probe = 0; probe < 100; probe++) {
      const candidate = `${prefix}-${String(n + 1).padStart(4, '0')}`;
      const conflict = await this.productRepository.findOne({
        where: { sku: candidate },
      });
      if (!conflict) return candidate;
      n += 1;
    }
    // Garde-fou (quasi impossible d'y arriver) : suffixe horodaté.
    return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
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
