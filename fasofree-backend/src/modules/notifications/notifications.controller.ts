import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { NotificationStoreService } from './notification-store.service';
import { BusinessesService } from '../businesses/businesses.service';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly usersService: UsersService,
    private readonly store: NotificationStoreService,
    private readonly businessesService: BusinessesService,
  ) {}

  @Post('fcm-token')
  @ApiOperation({ summary: 'Enregistrer le token FCM' })
  @ApiResponse({ status: 200, description: 'Token mis à jour' })
  async updateFcmToken(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateFcmTokenDto,
  ): Promise<{ message: string }> {
    await this.usersService.updateFcmToken(userId, dto.fcmToken);
    return { message: 'FCM Token enregistré avec succès' };
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer les notifications de l\'utilisateur' })
  async getNotifications(
    @CurrentUser('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.store.findAllByUser(userId, {
      limit: limit ? Number(limit) : 30,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  async markAsRead(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    await this.store.markAsRead(id, userId);
    return { message: 'Notification marquée comme lue' };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marquer toutes les notifications comme lues' })
  async markAllAsRead(@CurrentUser('userId') userId: string) {
    await this.store.markAllAsRead(userId);
    return { message: 'Toutes les notifications marquées comme lues' };
  }

  // ========================================================================
  // 📤 ENVOI MANUEL DE NOTIFICATIONS (admin / superadmin)
  // ========================================================================
  @Post('send')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.BUSINESS_ADMIN)
  @ApiOperation({ summary: 'Envoyer une notification à un ou plusieurs utilisateurs' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userIds', 'title', 'body'],
      properties: {
        userIds: { type: 'array', items: { type: 'string' }, description: 'IDs des destinataires' },
        title: { type: 'string', description: 'Titre de la notification' },
        body: { type: 'string', description: 'Contenu de la notification' },
        actionUrl: { type: 'string', description: 'Lien optionnel' },
      },
    },
  })
  async sendNotification(
    @Body() body: { userIds: string[]; title: string; body: string; actionUrl?: string },
    @CurrentUser('userId') senderId: string,
    @CurrentUser('role') senderRole: UserRole,
  ) {
    if (!body.userIds?.length || !body.title || !body.body) {
      throw new BadRequestException('userIds, title et body sont requis');
    }

    // 🔒 Un BUSINESS_ADMIN ne peut notifier que les clients de ses propres agences
    if (senderRole === UserRole.BUSINESS_ADMIN) {
      const managedBusinesses = await this.businessesService.findAllByOwner(senderId);
      const managedBusinessIds = managedBusinesses.map((b) => b.id);

      if (managedBusinessIds.length === 0) {
        throw new ForbiddenException('Vous ne gérez aucun commerce');
      }

      // Vérifier que chaque userId est bien un client ayant commandé dans l'une de ses agences
      // Via une requête directe sur la table orders
      const store = this.store;
      const validClientIds = await store.findClientsOfBusinesses(managedBusinessIds);
      const invalidIds = body.userIds.filter((id) => !validClientIds.includes(id));

      if (invalidIds.length > 0) {
        throw new ForbiddenException(
          `Vous ne pouvez notifier que les clients de vos agences. IDs invalides: ${invalidIds.join(', ')}`,
        );
      }
    }

    const count = await this.store.sendToUsers(
      body.userIds,
      body.title,
      body.body,
      undefined,
      body.actionUrl,
    );
    return { message: `${count} notification(s) envoyée(s)`, count };
  }

  @Post('broadcast')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Diffuser une notification à tous les utilisateurs d\'un rôle' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['role', 'title', 'body'],
      properties: {
        role: { type: 'string', enum: ['client', 'driver', 'courier', 'business_admin', 'super_admin'], description: 'Rôle cible' },
        title: { type: 'string', description: 'Titre de la notification' },
        body: { type: 'string', description: 'Contenu de la notification' },
        actionUrl: { type: 'string', description: 'Lien optionnel' },
      },
    },
  })
  async broadcastNotification(
    @Body() body: { role: string; title: string; body: string; actionUrl?: string },
    @CurrentUser('userId') senderId: string,
  ) {
    if (!body.role || !body.title || !body.body) {
      throw new BadRequestException('role, title et body sont requis');
    }
    const count = await this.store.broadcastToRole(
      body.role,
      body.title,
      body.body,
      undefined,
      body.actionUrl,
    );
    return { message: `${count} notification(s) diffusée(s) au rôle ${body.role}`, count };
  }
}
