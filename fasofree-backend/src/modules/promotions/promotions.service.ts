import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { WalletService } from '../wallets/wallet.service';
import { TransactionReason } from '../wallets/entities/wallet-transaction.entity';
import { UserRole as WalletUserRole } from '../wallets/entities/wallet.entity';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { Promotion, PromotionKind } from './entities/promotion.entity';
import { Referral, ReferralStatus } from './entities/referral.entity';
import { USER_REGISTERED } from './events/promotion.events';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);
  constructor(
    @InjectRepository(Promotion)
    private readonly promotions: Repository<Promotion>,
    @InjectRepository(Referral)
    private readonly referrals: Repository<Referral>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly wallets: WalletService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreatePromotionDto): Promise<Promotion> {
    if (new Date(dto.endsAt) <= new Date(dto.startsAt))
      throw new BadRequestException('La fin doit être postérieure au début');
    return this.promotions.save(
      this.promotions.create({
        ...dto,
        code: dto.code.trim().toUpperCase(),
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        minimumOrderAmount: dto.minimumOrderAmount ?? 0,
        usageLimit: dto.usageLimit ?? null,
        usageCount: 0,
        active: true,
      }),
    );
  }

  async quote(
    code: string,
    orderAmount: number,
  ): Promise<{ promotion: Promotion; discount: number }> {
    const promotion = await this.promotions.findOne({
      where: { code: code.trim().toUpperCase(), active: true },
    });
    if (
      !promotion ||
      promotion.startsAt > new Date() ||
      promotion.endsAt < new Date() ||
      (promotion.usageLimit !== null &&
        promotion.usageCount >= promotion.usageLimit)
    ) {
      throw new BadRequestException('Code promotionnel invalide ou expiré');
    }
    if (Number(orderAmount) < Number(promotion.minimumOrderAmount))
      throw new BadRequestException('Montant minimum non atteint');
    const discount =
      promotion.kind === PromotionKind.PERCENTAGE
        ? Number(
            ((Number(orderAmount) * Number(promotion.value)) / 100).toFixed(2),
          )
        : Math.min(Number(promotion.value), Number(orderAmount));
    return { promotion, discount };
  }

  /**
   * Réserve une utilisation de façon atomique : deux commandes concurrentes ne
   * peuvent donc pas dépasser la limite configurée d'un même code.
   */
  async reserve(promotionId: string): Promise<void> {
    const result = await this.promotions
      .createQueryBuilder()
      .update(Promotion)
      .set({ usageCount: () => '"usageCount" + 1' })
      .where('id = :id', { id: promotionId })
      .andWhere('active = true')
      .andWhere('"startsAt" <= NOW()')
      .andWhere('"endsAt" >= NOW()')
      .andWhere('("usageLimit" IS NULL OR "usageCount" < "usageLimit")')
      .execute();

    if (result.affected !== 1) {
      throw new BadRequestException('Code promotionnel épuisé ou expiré');
    }
  }

  async release(promotionId: string): Promise<void> {
    await this.promotions
      .createQueryBuilder()
      .update(Promotion)
      .set({ usageCount: () => 'GREATEST("usageCount" - 1, 0)' })
      .where('id = :id', { id: promotionId })
      .execute();
  }

  @OnEvent(USER_REGISTERED, { async: true })
  async rewardReferral(event: {
    userId: string;
    referralCode?: string;
  }): Promise<void> {
    if (!event.referralCode) return;
    const referrer = await this.users.findOne({
      where: { referralCode: event.referralCode.trim().toUpperCase() },
    });
    if (!referrer || referrer.id === event.userId) return;
    const existing = await this.referrals.findOne({
      where: { refereeId: event.userId },
    });
    if (existing) return;
    const amount = this.config.get<number>('REFERRAL_REWARD_XOF', 500);
    const referral = await this.referrals.save(
      this.referrals.create({
        referrerId: referrer.id,
        refereeId: event.userId,
        status: ReferralStatus.REWARDED,
        rewardAmount: amount,
      }),
    );
    try {
      await this.wallets.creditWallet(
        referrer.id,
        WalletUserRole.CUSTOMER,
        amount,
        TransactionReason.REFERRAL_REWARD,
        referral.id,
        'Récompense de parrainage',
      );
    } catch (error) {
      await this.referrals.remove(referral);
      this.logger.error(
        `Échec de récompense de parrainage ${referral.id}`,
        error,
      );
    }
  }
}
