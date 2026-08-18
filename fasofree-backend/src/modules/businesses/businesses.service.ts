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

  // 🏪 1b. Trouver le commerce d'un marchand
  async findByOwner(ownerId: string): Promise<Business | null> {
    return this.businessRepository.findOne({ where: { ownerId } });
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
      return await this.businessRepository
        .createQueryBuilder('business')
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
        .andWhere('business.isOpen = true')
        .getMany();
    } catch {
      // PostGIS indisponible → fallback Haversine sur les colonnes lat/lng
      const all = await this.businessRepository.find({ where: { isOpen: true } });
      return all.filter((b) => {
        if (b.latitude == null || b.longitude == null) return false;
        const R = 6371e3;
        const dLat = ((b.latitude - dto.latitude) * Math.PI) / 180;
        const dLon = ((b.longitude - dto.longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((dto.latitude * Math.PI) / 180) *
            Math.cos((b.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radiusMeters;
      });
    }
  }

  // 🏪 2bis. Lister tous les commerces (Super Admin)
  async findAll(): Promise<Business[]> {
    return this.businessRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  // 🔍 3. Trouver un commerce par son ID
  async findOne(id: string): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { id },
      relations: { products: true }, // 💡 Syntax objet typée pour TypeORM
    });

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

    // Mise à jour de la géolocalisation si fournie
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      business.location = {
        type: 'Point',
        coordinates: [dto.longitude, dto.latitude],
      };
    }

    return this.businessRepository.save(business);
  }
}
