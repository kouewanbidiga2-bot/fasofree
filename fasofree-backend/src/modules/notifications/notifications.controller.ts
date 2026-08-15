import { Controller, Post, Body, UseGuards } from '@nestjs/common';
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

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly usersService: UsersService) {}

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
}
