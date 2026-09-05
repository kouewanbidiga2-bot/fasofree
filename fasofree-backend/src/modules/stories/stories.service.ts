import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { Story, StoryMediaType } from './entities/story.entity';
import { StoryView } from './entities/story-view.entity';
import { StoryLike } from './entities/story-like.entity';
import { Business } from '../businesses/entities/business.entity';
import { UserRole } from '../users/entities/user-role.enum';

@Injectable()
export class StoriesService {
  private readonly logger = new Logger(StoriesService.name);

  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StoryView)
    private readonly storyViewRepository: Repository<StoryView>,
    @InjectRepository(StoryLike)
    private readonly storyLikeRepository: Repository<StoryLike>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  async createStory(
    businessId: string,
    userId: string,
    role: string,
    mediaUrl: string,
    mediaType: StoryMediaType,
    caption?: string,
  ): Promise<Story> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new BadRequestException('Business not found');
    }

    if (role !== UserRole.SUPER_ADMIN) {
      const owned = await this.businessRepository
        .createQueryBuilder('biz')
        .leftJoin('biz.brand', 'brand')
        .where('biz.id = :businessId', { businessId })
        .andWhere('(biz.ownerId = :userId OR brand.ownerId = :userId)', {
          userId,
        })
        .getOne();
      if (!owned) {
        throw new ForbiddenException(
          'Vous ne pouvez creer une story que sur votre propre commerce',
        );
      }
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const story = this.storyRepository.create({
      businessId,
      createdById: userId,
      mediaUrl,
      mediaType: mediaType || StoryMediaType.IMAGE,
      caption,
      expiresAt,
    });

    const saved = await this.storyRepository.save(story);
    this.logger.log(`Story created: ${saved.id} for business ${businessId}`);
    return saved;
  }

  async getActiveStories(userId?: string): Promise<any[]> {
    const now = new Date();
    const stories = await this.storyRepository
      .createQueryBuilder('story')
      .leftJoinAndSelect('story.business', 'business')
      .leftJoinAndSelect('story.createdBy', 'createdBy')
      .where('story.expiresAt > :now', { now })
      .orderBy('story.createdAt', 'DESC')
      .getMany();

    const storyIds = stories.map((s) => s.id);

    let viewedStoryIds = new Set<string>();
    let likedStoryIds = new Set<string>();

    if (userId && storyIds.length > 0) {
      const views = await this.storyViewRepository.find({
        where: { storyId: In(storyIds), userId },
      });
      viewedStoryIds = new Set(views.map((v) => v.storyId));

      const likes = await this.storyLikeRepository.find({
        where: { storyId: In(storyIds), userId },
      });
      likedStoryIds = new Set(likes.map((l) => l.storyId));
    }

    const grouped: Record<string, any> = {};

    for (const story of stories) {
      const bid = story.businessId;
      if (!grouped[bid]) {
        grouped[bid] = {
          businessId: bid,
          businessName: story.business?.name || '',
          businessImage: story.business?.logo || '',
          stories: [],
        };
      }

      grouped[bid].stories.push({
        id: story.id,
        mediaUrl: story.mediaUrl,
        mediaType: story.mediaType,
        caption: story.caption,
        viewsCount: story.viewsCount,
        likesCount: story.likesCount,
        viewed: viewedStoryIds.has(story.id),
        isLiked: likedStoryIds.has(story.id),
        expiresAt: story.expiresAt,
        createdAt: story.createdAt,
      });
    }

    return Object.values(grouped);
  }

  async viewStory(storyId: string, userId: string): Promise<void> {
    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });
    if (!story) {
      throw new BadRequestException('Story not found');
    }

    if (new Date() > story.expiresAt) {
      throw new BadRequestException('Story has expired');
    }

    const existingView = await this.storyViewRepository.findOne({
      where: { storyId, userId },
    });
    if (!existingView) {
      await this.storyViewRepository.save(
        this.storyViewRepository.create({ storyId, userId }),
      );
      await this.storyRepository.increment({ id: storyId }, 'viewsCount', 1);
    }
  }

  async likeStory(storyId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> {
    const story = await this.storyRepository.findOne({ where: { id: storyId } });
    if (!story) throw new NotFoundException('Story introuvable');
    if (new Date() > story.expiresAt) throw new BadRequestException('Story expiree');

    const existing = await this.storyLikeRepository.findOne({
      where: { storyId, userId },
    });

    if (existing) {
      return { liked: true, likesCount: story.likesCount };
    }

    await this.storyLikeRepository.save(
      this.storyLikeRepository.create({ storyId, userId }),
    );
    await this.storyRepository.increment({ id: storyId }, 'likesCount', 1);

    return { liked: true, likesCount: story.likesCount + 1 };
  }

  async unlikeStory(storyId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> {
    const story = await this.storyRepository.findOne({ where: { id: storyId } });
    if (!story) throw new NotFoundException('Story introuvable');

    const existing = await this.storyLikeRepository.findOne({
      where: { storyId, userId },
    });

    if (!existing) {
      return { liked: false, likesCount: story.likesCount };
    }

    await this.storyLikeRepository.remove(existing);
    await this.storyRepository.decrement({ id: storyId }, 'likesCount', 1);

    return { liked: false, likesCount: Math.max(0, story.likesCount - 1) };
  }

  async getStoryViewers(storyId: string, ownerId: string): Promise<any[]> {
    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });
    if (!story) {
      throw new BadRequestException('Story not found');
    }
    if (story.createdById !== ownerId) {
      throw new ForbiddenException('Only the story owner can see viewers');
    }

    const views = await this.storyViewRepository
      .createQueryBuilder('view')
      .leftJoinAndSelect('view.user', 'user')
      .where('view.storyId = :storyId', { storyId })
      .orderBy('view.viewedAt', 'DESC')
      .getMany();

    return views.map((v) => ({
      userId: v.userId,
      name: v.user?.fullName || 'Unknown',
      avatar: v.user?.avatarUrl || null,
      viewedAt: v.viewedAt,
    }));
  }

  async deleteStory(storyId: string, ownerId: string): Promise<void> {
    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });
    if (!story) {
      throw new BadRequestException('Story not found');
    }
    if (story.createdById !== ownerId) {
      throw new ForbiddenException('Only the story owner can delete it');
    }
    await this.storyRepository.remove(story);
  }

  async cleanupExpiredStories(): Promise<number> {
    const now = new Date();
    const expired = await this.storyRepository.find({
      where: { expiresAt: LessThanOrEqual(now) },
    });
    if (expired.length > 0) {
      await this.storyRepository.remove(expired);
      this.logger.log(`Cleaned up ${expired.length} expired stories`);
    }
    return expired.length;
  }
}
