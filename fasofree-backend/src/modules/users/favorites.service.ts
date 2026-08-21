import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly repo: Repository<Favorite>,
  ) {}

  async toggle(userId: string, businessId: string): Promise<{ isFavorited: boolean }> {
    const existing = await this.repo.findOne({ where: { userId, businessId } });
    if (existing) {
      await this.repo.remove(existing);
      return { isFavorited: false };
    }
    const fav = this.repo.create({ userId, businessId });
    await this.repo.save(fav);
    return { isFavorited: true };
  }

  async findAllByUser(userId: string): Promise<Favorite[]> {
    return this.repo.find({
      where: { userId },
      relations: ['business'],
      order: { createdAt: 'DESC' },
    });
  }

  async isFavorited(userId: string, businessId: string): Promise<boolean> {
    const count = await this.repo.count({ where: { userId, businessId } });
    return count > 0;
  }

  async getFavoritedIds(userId: string): Promise<string[]> {
    const favs = await this.repo.find({ where: { userId }, select: ['businessId'] });
    return favs.map((f) => f.businessId);
  }
}
