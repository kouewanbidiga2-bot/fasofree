import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoyaltyPoint, LoyaltySource } from './entities/loyalty-point.entity';
import { Referral } from './entities/referral.entity';
import { User } from '../users/entities/user.entity';

const POINTS_PER_100FCFA = 1;
const REFERRER_BONUS = 500;
const REFERRED_BONUS = 200;

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    @InjectRepository(LoyaltyPoint)
    private readonly loyaltyPointRepository: Repository<LoyaltyPoint>,
    @InjectRepository(Referral)
    private readonly referralRepository: Repository<Referral>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getPointsBalance(userId: string): Promise<number> {
    const result = await this.loyaltyPointRepository
      .createQueryBuilder('lp')
      .select('COALESCE(SUM(lp.points), 0)', 'total')
      .where('lp.userId = :userId', { userId })
      .getRawOne();
    return parseInt(result?.total || '0', 10);
  }

  async earnPointsFromOrder(userId: string, orderId: string, orderAmount: number): Promise<number> {
    const pointsEarned = Math.floor(orderAmount / 100) * POINTS_PER_100FCFA;
    if (pointsEarned <= 0) return 0;

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 12);

    const point = this.loyaltyPointRepository.create({
      userId,
      points: pointsEarned,
      source: LoyaltySource.ORDER,
      orderId,
      description: `Commande #${orderId.slice(0, 8)}`,
      expiresAt,
    });
    await this.loyaltyPointRepository.save(point);
    this.logger.log(`Earned ${pointsEarned} points for user ${userId} from order ${orderId}`);
    return pointsEarned;
  }

  async earnReferralBonus(referrerUserId: string, referredUserId: string): Promise<void> {
    const existing = await this.referralRepository.findOne({
      where: { referredUserId },
    });
    if (existing) return;

    const referrerExpires = new Date();
    referrerExpires.setMonth(referrerExpires.getMonth() + 12);
    const referredExpires = new Date();
    referredExpires.setMonth(referredExpires.getMonth() + 12);

    await this.loyaltyPointRepository.save([
      this.loyaltyPointRepository.create({
        userId: referrerUserId,
        points: REFERRER_BONUS,
        source: LoyaltySource.REFERRAL,
        description: 'Parrainage - Parrain',
        expiresAt: referrerExpires,
      }),
      this.loyaltyPointRepository.create({
        userId: referredUserId,
        points: REFERRED_BONUS,
        source: LoyaltySource.REFERRAL,
        description: 'Parrainage - Filleul',
        expiresAt: referredExpires,
      }),
    ]);

    await this.referralRepository.save(
      this.referralRepository.create({
        referrerUserId,
        referredUserId,
        referrerBonus: REFERRER_BONUS,
        referredBonus: REFERRED_BONUS,
      }),
    );

    this.logger.log(`Referral bonus: ${referrerUserId} -> ${referredUserId}`);
  }

  async redeemPoints(userId: string, points: number, description: string): Promise<number> {
    const balance = await this.getPointsBalance(userId);
    if (balance < points) {
      throw new BadRequestException(`Solde insuffisant. Vous avez ${balance} points.`);
    }

    const redemption = this.loyaltyPointRepository.create({
      userId,
      points: -points,
      source: LoyaltySource.REDEMPTION,
      description,
    });
    await this.loyaltyPointRepository.save(redemption);
    this.logger.log(`Redeemed ${points} points for user ${userId}`);
    return balance - points;
  }

  async earnStreakBonus(userId: string, streakDays: number): Promise<number> {
    let bonus = 0;
    if (streakDays >= 7) bonus = 100;
    else if (streakDays >= 3) bonus = 50;
    else return 0;

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 6);

    const point = this.loyaltyPointRepository.create({
      userId,
      points: bonus,
      source: LoyaltySource.STREAK,
      description: `Streak ${streakDays} jours`,
      expiresAt,
    });
    await this.loyaltyPointRepository.save(point);
    this.logger.log(`Streak bonus: ${bonus} points for user ${userId} (${streakDays} days)`);
    return bonus;
  }

  async getPointsHistory(userId: string): Promise<LoyaltyPoint[]> {
    return this.loyaltyPointRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    if (user.referralCode) return user.referralCode;

    const code = `FS${userId.slice(0, 8).toUpperCase()}`;
    await this.userRepository.update(userId, { referralCode: code });
    return code;
  }

  async getReferralStats(userId: string): Promise<any> {
    const code = await this.generateReferralCode(userId);
    const referrals = await this.referralRepository.find({
      where: { referrerUserId: userId },
    });
    const totalReferred = referrals.length;
    const completedReferrals = referrals.filter((r) => r.firstOrderCompleted).length;

    return {
      referralCode: code,
      totalReferred,
      completedReferrals,
      pendingBonus: (totalReferred - completedReferrals) * REFERRER_BONUS,
    };
  }

  async applyReferralCode(newUserId: string, code: string): Promise<void> {
    const referrer = await this.userRepository.findOne({
      where: { referralCode: code },
    });
    if (!referrer) throw new BadRequestException('Code de parrainage invalide');
    if (referrer.id === newUserId) throw new BadRequestException('Vous ne pouvez pas vous parrainer vous-meme');

    const existing = await this.referralRepository.findOne({
      where: { referredUserId: newUserId },
    });
    if (existing) throw new BadRequestException('Vous etes deja parraine');

    await this.earnReferralBonus(referrer.id, newUserId);
  }
}
