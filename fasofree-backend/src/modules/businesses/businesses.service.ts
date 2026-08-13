import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from './entities/business.entity';
import { CreateBusinessDto } from './dto/create-business.dto';
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
      location: {
        type: 'Point',
        coordinates: [dto.longitude, dto.latitude], // ⚠️ Format GeoJSON : [Longitude, Latitude]
      },
    });

    return this.businessRepository.save(business);
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

  // 📍 2. Recherche spatiale PostGIS : Commerces dans un rayon donné
  async findNearby(dto: FindNearbyDto): Promise<Business[]> {
    const radiusMeters = (dto.radiusInKm || 5) * 1000;

    return this.businessRepository
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
}
