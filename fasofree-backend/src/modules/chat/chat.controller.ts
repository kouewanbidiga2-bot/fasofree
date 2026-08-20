import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request as NestRequest,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { Roles } from '../../core/security/roles.decorator';
import { RolesGuard } from '../../core/security/roles.guard';
import { UserRole } from '../users/entities/user-role.enum';
import { ChatService } from './chat.service';
import { ChatChannel } from './entities/order-chat-message.entity';
import { OrdersService } from '../orders/orders.service';

type RequestWithUser = ExpressRequest & {
  user?: { userId?: string; role?: string };
};

@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * 📋 Commandes avec conversations actives (admin/support/super_admin).
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Liste des conversations actives (Admin/Support)' })
  async getActiveConversations() {
    return this.chatService.getActiveConversations();
  }

  /**
   * 📜 Historique / archive d'un canal de discussion d'une commande.
   * Accessible uniquement aux participants du canal.
   */
  @Get(':orderId')
  @ApiOperation({
    summary:
      "Historique du chat éphémère d'une commande (canal merchant|driver)",
  })
  @ApiResponse({ status: 200, description: 'Historique récupéré' })
  @ApiResponse({ status: 401, description: 'Utilisateur non authentifié' })
  @ApiResponse({ status: 403, description: 'Non participant au canal' })
  @ApiResponse({ status: 404, description: 'Commande introuvable' })
  async getChatHistory(
    @Param('orderId') orderId: string,
    @Query('channel') channel?: string,
    @NestRequest() req?: RequestWithUser,
  ) {
    const userId = req?.user?.userId;
    const role = req?.user?.role;
    if (!userId || !role) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    const selectedChannel: ChatChannel =
      channel === ChatChannel.MERCHANT
        ? ChatChannel.MERCHANT
        : ChatChannel.DRIVER;

    // ✅ L'ordre doit exister et l'utilisateur être habilité (client, manager, admin)
    const order = await this.ordersService.findOneForUser(
      orderId,
      userId,
      role as UserRole,
    );

    // ✅ Vérification du droit d'accès au canal
    const allowed = await this.chatService.canAccessChannel(
      order,
      userId,
      role,
      selectedChannel,
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Vous ne participez pas à ce canal de discussion.',
      );
    }

    const history = await this.chatService.getHistory(orderId, selectedChannel);

    return {
      orderId,
      status: order.status,
      channel: selectedChannel,
      active: this.chatService.isChatActive(order.status),
      history,
    };
  }
}
