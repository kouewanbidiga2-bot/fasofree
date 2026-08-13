import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  // Créer un avis (avec pourboire optionnel)
  async createReview(
    reviewerId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    // Vérifier qu'il n'y a pas déjà un avis pour cette commande + ce type de cible
    const existing = await this.reviewRepository.findOne({
      where: { orderId: dto.orderId, targetType: dto.targetType },
    });
    if (existing) {
      throw new BadRequestException(
        'Vous avez déjà noté cette commande pour ce type de cible',
      );
    }

    const review = this.reviewRepository.create({
      orderId: dto.orderId,
      reviewerId,
      targetId: dto.targetId,
      targetType: dto.targetType,
      score: dto.score,
      comment: dto.comment,
      tipAmount: dto.tipAmount || 0,
      tipPaid: false,
    });

    const saved = await this.reviewRepository.save(review);
    this.logger.log(
      `[Review Created] Commande #${dto.orderId} | Note: ${dto.score}/5 | Pourboire: ${dto.tipAmount || 0} FCFA`,
    );
    return saved;
  }

  // Obtenir les avis d'un livreur/coursier/commerce
  async getReviewsForTarget(targetId: string): Promise<Review[]> {
    return this.reviewRepository.find({
      where: { targetId },
      order: { createdAt: 'DESC' },
    });
  }

  // Calculer la note moyenne d'un livreur/coursier/commerce
  async getAverageRating(
    targetId: string,
  ): Promise<{ average: number; count: number }> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.score)', 'average')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.targetId = :targetId', { targetId })
      .getRawOne();

    return {
      average: result?.average
        ? parseFloat(parseFloat(result.average).toFixed(1))
        : 0,
      count: parseInt(result?.count || '0', 10),
    };
  }

  // Obtenir les avis d'une commande
  async getReviewsForOrder(orderId: string): Promise<Review[]> {
    return this.reviewRepository.find({
      where: { orderId },
    });
  }

  // Marquer le pourboire comme payé
  async markTipAsPaid(reviewId: string): Promise<void> {
    await this.reviewRepository.update(reviewId, { tipPaid: true });
  }

  // Récupérer les pourboires non payés
  async getUnpaidTips(): Promise<Review[]> {
    return this.reviewRepository.find({
      where: { tipPaid: false },
    });
  }
}
