import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from './entities/business.entity';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { FindNearbyDto } from './dto/find-nearby.dto';
import { UserRole } from '../users/entities/user-role.enum';

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  // 🏪 1. Créer un commerce avec sa géolocalisation
  async create(dto: CreateBusinessDto, ownerId: string): Promise<Business> {
    const business = this.businessRepository.create({
      name: dto.name,
      address: dto.address,
      phone: dto.phone,
      ownerId,
      brandId: dto.brandId ?? null,
      location: {
        type: 'Point',
        coordinates: [dto.longitude, dto.latitude], // ⚠️ Format GeoJSON : [Longitude, Latitude]
      },
    });

    return this.businessRepository.save(business);
  }

  // 🏪 1b. Trouver le commerce d'un marchand (inclut les produits)
  async findByOwner(ownerId: string): Promise<Business | null> {
    return this.businessRepository.findOne({
      where: { ownerId },
      relations: { products: true },
    });
  }

  async assertManagedBy(
    businessId: string,
    userId: string,
    role: UserRole,
  ): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Commerce introuvable');
    if (role !== UserRole.SUPER_ADMIN && business.ownerId !== userId) {
      throw new ForbiddenException('Vous ne pouvez pas gérer ce commerce');
    }
    return business;
  }

  // 📍 2. Recherche spatiale : Commerces dans un rayon donné
  // Essaie PostGIS d'abord, fallback Haversine si l'extension n'est pas dispo.
  async findNearby(dto: FindNearbyDto): Promise<Business[]> {
    const radiusMeters = (dto.radiusInKm || 5) * 1000;

    try {
      const query = this.businessRepository
        .createQueryBuilder('business')
        .select([
          'business.id',
          'business.name',
          'business.address',
          'business.phone',
          'business.logo',
          'business.coverImage',
          'business.category',
          'business.isOpen',
          'business.enableDelivery',
          'business.enablePickup',
          'business.enableDineIn',
          'business.latitude',
          'business.longitude',
        ])
        .where(
          `ST_DWithin(
            business.location::geography,
            ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
            :radius
          )`,
          {
            longitude: dto.longitude,
            latitude: dto.latitude,
            radius: radiusMeters,
          },
        )
        .andWhere('business.isOpen = true');

      if (dto.category) {
        query.andWhere('business.category = :category', { category: dto.category });
      }

      // Tri par distance pour garantir un ordre déterministe
      query.orderBy(
        `ST_Distance(
          business.location::geography,
          ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
        )`,
        'ASC'
      );

      return await query.getMany();
    } catch {
      // PostGIS indisponible → fallback Haversine sur les colonnes lat/lng
      const query = this.businessRepository
        .createQueryBuilder('business')
        .select([
          'business.id',
          'business.name',
          'business.address',
          'business.phone',
          'business.logo',
          'business.coverImage',
          'business.category',
          'business.isOpen',
          'business.enableDelivery',
          'business.enablePickup',
          'business.enableDineIn',
          'business.latitude',
          'business.longitude',
        ])
        .where('business.isOpen = true');

      if (dto.category) {
        query.andWhere('business.category = :category', { category: dto.category });
      }

      const all = await query.getMany();
      const filteredAndSorted = all.filter((b) => {
        if (b.latitude == null || b.longitude == null) return false;
        const R = 6371e3;
        const dLat = ((b.latitude - dto.latitude) * Math.PI) / 180;
        const dLon = ((b.longitude - dto.longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((dto.latitude * Math.PI) / 180) *
            Math.cos((b.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
        const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        b['distance'] = distance;
        return distance <= radiusMeters;
      });

      return filteredAndSorted.sort((a, b) => (a['distance'] || 0) - (b['distance'] || 0));
    }
  }

  // 🏪 2bis. Lister tous les commerces (Super Admin)
  async findAll(): Promise<Business[]> {
    return this.businessRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  // 🏷️ 2ter. Retourne les marques groupées avec leurs agences
  // Chaque marque = 1 carte sur le front, les agences sont à l'intérieur
  async findGrouped(latitude?: number, longitude?: number): Promise<any[]> {
    // 1. Charger toutes les marques
    const brands = await this.businessRepository
      .createQueryBuilder('b')
      .select([
        'b.brandId',
        'b.id',
        'b.name',
        'b.address',
        'b.phone',
        'b.logo',
        'b.coverImage',
        'b.category',
        'b.isOpen',
        'b.enableDelivery',
        'b.enablePickup',
        'b.latitude',
        'b.longitude',
      ])
      .where('b.isOpen = true')
      .getMany();

    // 2. Grouper par brandId
    const brandMap = new Map<string, Business[]>();
    const noBrand: Business[] = [];

    for (const b of brands) {
      if (b.brandId) {
        const list = brandMap.get(b.brandId) || [];
        list.push(b);
        brandMap.set(b.brandId, list);
      } else {
        noBrand.push(b);
      }
    }

    // 3. Construire le résultat groupé
    const result: any[] = [];

    // Marques avec agences : 1 entrée par marque
    for (const [brandId, branches] of brandMap) {
      // Si coordonnées fournies, calculer la distance de la plus proche agence
      let nearestBranch = branches[0];
      if (latitude != null && longitude != null) {
        const R = 6371e3;
        let minDist = Infinity;
        for (const b of branches) {
          if (b.latitude != null && b.longitude != null) {
            const dLat = ((b.latitude - latitude) * Math.PI) / 180;
            const dLon = ((b.longitude - longitude) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos((latitude * Math.PI) / 180) *
                Math.cos((b.latitude * Math.PI) / 180) *
                Math.sin(dLon / 2) ** 2;
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            if (dist < minDist) {
              minDist = dist;
              nearestBranch = b;
            }
          }
        }
      }

      result.push({
        id: nearestBranch.id, // Le front utilise l'id du business le plus proche
        brandId,
        name: nearestBranch.name.replace(/ - .+$/, ''), // "Chitir Chicken" au lieu de "Chitir Chicken - Kamboinsin"
        displayName: nearestBranch.name, // Nom complet de la branche la plus proche
        isBrand: true,
        branchCount: branches.length,
        branches: branches.map((b) => ({
          id: b.id,
          name: b.name,
          address: b.address,
          isOpen: b.isOpen,
          latitude: b.latitude,
          longitude: b.longitude,
        })),
        logo: nearestBranch.logo,
        coverImage: nearestBranch.coverImage,
        category: nearestBranch.category,
        phone: nearestBranch.phone,
        deliveryTime: '25-40 min',
        latitude: nearestBranch.latitude,
        longitude: nearestBranch.longitude,
      });
    }

    // Business sans marque : carte individuelle
    for (const b of noBrand) {
      result.push({
        id: b.id,
        brandId: null,
        name: b.name,
        displayName: b.name,
        isBrand: false,
        branchCount: 0,
        branches: [],
        logo: b.logo,
        coverImage: b.coverImage,
        category: b.category,
        phone: b.phone,
        deliveryTime: '25-40 min',
        latitude: b.latitude,
        longitude: b.longitude,
      });
    }

    return result;
  }

  // 🔍 3. Trouver un commerce par son ID (UUID) ou par nom (fallback)
  async findOne(id: string): Promise<Business> {
    // 1. Essayer par UUID
    let business = await this.businessRepository.findOne({
      where: { id },
      relations: { products: true },
    });

    // 2. Fallback : recherche par nom exact (insensible à la casse)
    if (!business) {
      business = await this.businessRepository.findOne({
        where: { name: id },
        relations: { products: true },
      });
    }

    // 3. Fallback : recherche partielle par nom
    if (!business) {
      business = await this.businessRepository
        .createQueryBuilder('b')
        .leftJoinAndSelect('b.products', 'products')
        .where('LOWER(b.name) LIKE LOWER(:name)', { name: `%${id}%` })
        .getOne();
    }

    if (!business) {
      throw new NotFoundException('Commerce introuvable');
    }

    return business;
  }

  // ⚙️ 4. Mettre à jour les paramètres d'un commerce
  async update(id: string, dto: UpdateBusinessDto): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { id },
    });

    if (!business) {
      throw new NotFoundException('Commerce introuvable');
    }

    // Mise à jour des champs fournis
    if (dto.name !== undefined) business.name = dto.name;
    if (dto.address !== undefined) business.address = dto.address;
    if (dto.phone !== undefined) business.phone = dto.phone;
    if (dto.category !== undefined) business.category = dto.category;
    if (dto.enableDelivery !== undefined)
      business.enableDelivery = dto.enableDelivery;
    if (dto.enablePickup !== undefined)
      business.enablePickup = dto.enablePickup;
    if (dto.enableDineIn !== undefined)
      business.enableDineIn = dto.enableDineIn;
    if (dto.hasOwnDrivers !== undefined)
      business.hasOwnDrivers = dto.hasOwnDrivers;
    if (dto.isOpen !== undefined) business.isOpen = dto.isOpen;
    if (dto.brandId !== undefined) business.brandId = dto.brandId;
    if (dto.logo !== undefined) (business as any).logo = dto.logo || null;
    if (dto.coverImage !== undefined) (business as any).coverImage = dto.coverImage || null;
    if (dto.mobileMoneyNumber !== undefined) business.mobileMoneyNumber = dto.mobileMoneyNumber || null;
    if (dto.mobileMoneyProvider !== undefined) (business as any).mobileMoneyProvider = dto.mobileMoneyProvider || null;

    // Mise à jour de la géolocalisation si fournie
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      business.location = {
        type: 'Point',
        coordinates: [dto.longitude, dto.latitude],
      };
    }

    return this.businessRepository.save(business);
  }

  // 🗑️ 5. Supprimer un commerce (Super Admin)
  // - Les produits et favoris liés sont supprimés en CASCADE par la base.
  // - Les commandes conservent leur businessId (colonne sans contrainte FK)
  //   afin de préserver l'historique et les données financières.
  async remove(id: string): Promise<{ message: string; id: string }> {
    const business = await this.businessRepository.findOne({
      where: { id },
    });

    if (!business) {
      throw new NotFoundException('Commerce introuvable');
    }

    await this.businessRepository.remove(business);

    return {
      message: `Commerce "${business.name}" supprimé`,
      id,
    };
  }

  async findTrending(limit = 10): Promise<Business[]> {
    return this.businessRepository
      .createQueryBuilder('b')
      .where('b.isActive = :active', { active: true })
      .orderBy('b.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  async findRecommendedForUser(userVisitedBusinessIds: string[], limit = 6): Promise<Business[]> {
    if (!userVisitedBusinessIds.length) {
      return this.findTrending(limit);
    }

    const businesses = await this.businessRepository
      .createQueryBuilder('b')
      .where('b.isActive = :active', { active: true })
      .andWhere('b.id NOT IN (:...visited)', { visited: userVisitedBusinessIds })
      .orderBy('b.rating', 'DESC')
      .limit(limit)
      .getMany();

    if (businesses.length < limit) {
      const extra = await this.findTrending(limit - businesses.length);
      const existingIds = new Set(businesses.map((b) => b.id));
      for (const b of extra) {
        if (!existingIds.has(b.id)) businesses.push(b);
      }
    }

    return businesses;
  }
}
