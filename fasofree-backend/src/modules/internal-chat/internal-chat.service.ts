import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InternalMessage,
  InternalChannel,
} from './entities/internal-message.entity';

export { InternalChannel } from './entities/internal-message.entity';
import { UserRole } from '../users/entities/user-role.enum';

const ALLOWED_ROLES: string[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.SUPPORT,
];

@Injectable()
export class InternalChatService {
  private readonly logger = new Logger(InternalChatService.name);

  constructor(
    @InjectRepository(InternalMessage)
    private readonly messageRepo: Repository<InternalMessage>,
  ) {}

  assertTeamAccess(role: string): void {
    if (!ALLOWED_ROLES.includes(role)) {
      throw new ForbiddenException(
        'Accès réservé aux rôles SUPER_ADMIN, ADMIN et SUPPORT',
      );
    }
  }

  async saveMessage(
    channel: InternalChannel,
    senderId: string,
    message: string,
    recipientId?: string,
  ): Promise<InternalMessage> {
    const entity = this.messageRepo.create({
      channel,
      senderId,
      message: message.trim(),
      recipientId: recipientId ?? null,
    });
    const saved = await this.messageRepo.save(entity);
    this.logger.debug(
      `[InternalChat] ${channel} | ${senderId} → ${recipientId ?? 'broadcast'}`,
    );
    return saved;
  }

  async getHistory(
    channel: InternalChannel,
    limit = 100,
  ): Promise<InternalMessage[]> {
    return this.messageRepo.find({
      where: { channel },
      order: { createdAt: 'ASC' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  async getDms(
    userId: string,
    otherUserId: string,
    limit = 100,
  ): Promise<InternalMessage[]> {
    return this.messageRepo
      .createQueryBuilder('msg')
      .where(
        `(msg.channel = :ch AND msg.senderId = :u1 AND msg.recipientId = :u2)
         OR (msg.channel = :ch AND msg.senderId = :u2 AND msg.recipientId = :u1)`,
        {
          ch: InternalChannel.GENERAL,
          u1: userId,
          u2: otherUserId,
        },
      )
      .orWhere('msg.channel = :dmCh AND (msg.senderId = :u1 OR msg.recipientId = :u1) AND (msg.senderId = :u2 OR msg.recipientId = :u2)', {
        dmCh: 'dm',
        u1: userId,
        u2: otherUserId,
      })
      .orderBy('msg.createdAt', 'ASC')
      .take(Math.min(Math.max(limit, 1), 500))
      .getMany();
  }

  async getRecentDmPartners(
    userId: string,
  ): Promise<{ userId: string; lastMessage: string; lastAt: Date }[]> {
    const result = await this.messageRepo
      .createQueryBuilder('msg')
      .select(
        `CASE WHEN msg."senderId" = :uid THEN msg."recipientId" ELSE msg."senderId" END`,
        'partnerId',
      )
      .addSelect('MAX(msg.createdAt)', 'lastAt')
      .addSelect(
        `(SELECT m2.message FROM internal_chat_messages m2
          WHERE (m2."senderId" = :uid AND m2."recipientId" = CASE WHEN msg."senderId" = :uid THEN msg."recipientId" ELSE msg."senderId" END)
             OR (m2."senderId" = CASE WHEN msg."senderId" = :uid THEN msg."recipientId" ELSE msg."senderId" END AND m2."recipientId" = :uid)
          ORDER BY m2.createdAt DESC LIMIT 1)`,
        'lastMessage',
      )
      .where(
        `(msg."senderId" = :uid OR msg."recipientId" = :uid) AND msg."recipientId" IS NOT NULL AND msg.channel = :dmCh`,
        { uid: userId, dmCh: 'dm' },
      )
      .groupBy(
        `CASE WHEN msg."senderId" = :uid THEN msg."recipientId" ELSE msg."senderId" END`,
      )
      .orderBy('MAX(msg.createdAt)', 'DESC')
      .limit(20)
      .getRawMany();

    return result.map((r) => ({
      userId: r.partnerId,
      lastMessage: r.lastMessage,
      lastAt: r.lastAt,
    }));
  }
}
