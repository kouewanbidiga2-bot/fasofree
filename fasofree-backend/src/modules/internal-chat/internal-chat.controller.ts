import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request as NestRequest,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { Roles } from '../../core/security/roles.decorator';
import { RolesGuard } from '../../core/security/roles.guard';
import { UserRole } from '../users/entities/user-role.enum';
import { InternalChatService } from './internal-chat.service';

type AuthRequest = ExpressRequest & {
  user: { userId: string; role: UserRole };
};

@ApiTags('Internal Chat')
@ApiBearerAuth('JWT-auth')
@Controller('internal-chat')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
export class InternalChatController {
  constructor(private readonly internalChatService: InternalChatService) {}

  @Get('history/:channel')
  @ApiOperation({ summary: 'Historique d\'un canal interne (general, operations, support, finance)' })
  getHistory(@Param('channel') channel: string) {
    return this.internalChatService.getHistory(channel as any);
  }

  @Get('dm/:recipientId')
  @ApiOperation({ summary: 'Historique DM avec un membre' })
  getDms(
    @Param('recipientId') recipientId: string,
    @NestRequest() req: AuthRequest,
  ) {
    return this.internalChatService.getDms(req.user.userId, recipientId);
  }

  @Get('dm-partners')
  @ApiOperation({ summary: 'Partenaires DM récents' })
  getDmPartners(@NestRequest() req: AuthRequest) {
    return this.internalChatService.getRecentDmPartners(req.user.userId);
  }
}
