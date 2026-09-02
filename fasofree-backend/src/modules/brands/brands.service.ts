import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brand } from './entities/brand.entity';
import { Business } from '../businesses/entities/business.entity';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { UserRole } from '../users/entities/user-role.enum';

/**
 * Distance Haversine (mètres) entre deux points GPS.
 * Fallback lorsque le champ PostGIS `location` est nul (agence non géolocalisée
 * ou extension PostGIS indisponible).
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Rayon terrestre en mètres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);

  constructor(
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  async create(dto: CreateBrandDto, ownerId: string): Promise<Brand> {
    const brand = this.brandRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      logoUrl: dto.logoUrl ?? null,
      ownerId: dto.ownerId ?? ownerId,
    });
    return this.brandRepository.save(brand);
  }

  async findAll(): Promise<Brand[]> {
    return this.brandRepository.find();
  }

  async findOne(id: string): Promise<Brand> {
    const brand = await this.brandRepository.findOne({
      where: { id },
      relations: { businesses: true },
    });
    if (!brand) throw new NotFoundException('Marque introuvable');
    return brand;
  }

  async assertManagedBy(
    brandId: string,
    userId: string,
    role: UserRole,
  ): Promise<Brand> {
    const brand = await this.brandRepository.findOne({
      where: { id: brandId },
    });
    if (!brand) throw new NotFoundException('Marque introuvable');
    if (role !== UserRole.SUPER_ADMIN && brand.ownerId !== userId) {
      throw new ForbiddenException('Vous ne pouvez pas gérer cette marque');
    }
    return brand;
  }

  async update(id: string, dto: UpdateBrandDto): Promise<Brand> {
    const brand = await this.assertExists(id);
    if (dto.name !== undefined) brand.name = dto.name;
    if (dto.description !== undefined) brand.description = dto.description;
    if (dto.logoUrl !== undefined) brand.logoUrl = dto.logoUrl;
    if (dto.ownerId !== undefined) brand.ownerId = dto.ownerId;
    return this.brandRepository.save(brand);
  }

  async remove(id: string): Promise<void> {
    const brand = await this.assertExists(id);
    await this.brandRepository.remove(brand);
  }

  /**
   * 🏪 Lister les agences d'une marque avec distance optionnelle
   * Si latitude/longitude fournis, ajoute la distance (Haversine) et trie du plus proche au plus éloigné.
   */
  async findBranchesWithDistance(
    brandId: string,
    latitude?: number,
    longitude?: number,
  ): Promise<Business[]> {
    const brand = await this.assertExists(brandId);

    const branches = await this.businessRepository.find({
      where: { brandId: brand.id },
      order: { createdAt: 'ASC' },
    });

    if (latitude === undefined || longitude === undefined) {
      return branches;
    }

    // Ajouter la distance Haversine à chaque agence et trier
    const withDistance = branches.map((b) => {
      const dist =
        b.latitude != null && b.longitude != null
          ? haversineDistanceMeters(latitude, longitude, b.latitude, b.longitude)
          : Infinity;
      return { ...b, distanceMeters: Math.round(dist) };
    });

    withDistance.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return withDistance as Business[];
  }

  /**
   * 📍 Routage par agence la plus proche (Brand -> Business enfants).
   * Sélectionne l'agence ouverte de la marque la plus proche des coordonnées
   * fournies (PostGIS ST_Distance sinon fallback Haversine).
   */
  async findNearestBusiness(
    brandId: string,
    latitude: number,
    longitude: number,
  ): Promise<Business | null> {
    const brand = await this.assertExists(brandId);

    try {
      const nearest = await this.businessRepository
        .createQueryBuilder('business')
        .where('business.brandId = :brandId', { brandId: brand.id })
        .andWhere('business.isOpen = true')
        .orderBy(
          `ST_Distance(
            business.location::geography,
            ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
          )`,
          'ASC',
        )
        .setParameters({ longitude, latitude })
        .limit(1)
        .getOne();

      if (nearest) return nearest;
    } catch (error) {
      // PostGIS indisponible ou geometry null -> on bascule en Haversine
      this.logger.warn(
        `[Brands] PostGIS indisponible, fallback Haversine: ${
          error instanceof Error ? error.message : 'erreur inconnue'
        }`,
      );
    }

    // Fallback Haversine : agences ouvertes géolocalisées par latitude/longitude
    const candidates = await this.businessRepository.find({
      where: { brandId: brand.id, isOpen: true },
    });

    const withCoords = candidates.filter(
      (b): b is Business & { latitude: number; longitude: number } =>
        b.latitude !== undefined &&
        b.longitude !== undefined &&
        b.latitude !== null &&
        b.longitude !== null,
    );

    if (withCoords.length === 0) return null;

    withCoords.sort(
      (a, b) =>
        haversineDistanceMeters(latitude, longitude, a.latitude, a.longitude) -
        haversineDistanceMeters(latitude, longitude, b.latitude, b.longitude),
    );

    return withCoords[0];
  }

  private async assertExists(id: string): Promise<Brand> {
    const brand = await this.brandRepository.findOne({ where: { id } });
    if (!brand) throw new NotFoundException('Marque introuvable');
    return brand;
  }
}
