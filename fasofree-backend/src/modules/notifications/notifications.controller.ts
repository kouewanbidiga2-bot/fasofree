import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { NotificationStoreService } from './notification-store.service';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly usersService: UsersService,
    private readonly store: NotificationStoreService,
  ) {}

  @Post('fcm-token')
  @ApiOperation({ summary: 'Enregistrer le token FCM' })
  @ApiResponse({ status: 200, description: 'Token mis à jour' })
  async updateFcmToken(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateFcmTokenDto,
  ): Promise<{ message: string }> {
    await this.usersService.updateFcmToken(userId, dto.fcmToken);
    return { message: 'FCM Token enregistré avec succès' };
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer les notifications de l\'utilisateur' })
  async getNotifications(
    @CurrentUser('id') userId: string,
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
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.store.markAsRead(id, userId);
    return { message: 'Notification marquée comme lue' };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marquer toutes les notifications comme lues' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    await this.store.markAllAsRead(userId);
    return { message: 'Toutes les notifications marquées comme lues' };
  }
}
