import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InternalMessage } from './entities/internal-message.entity';
import { InternalChatService } from './internal-chat.service';
import { InternalChatController } from './internal-chat.controller';
import { InternalChatGateway } from './internal-chat.gateway';
import { User } from '../users/entities/user.entity';
import { resolveJwtSecret } from '../../config/jwt.config';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InternalMessage, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = resolveJwtSecret(config);
        const expiresIn = config.get('JWT_EXPIRES_IN') || '7d';
        return { secret, signOptions: { expiresIn: expiresIn as any } };
      },
    }),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [InternalChatController],
  providers: [InternalChatService, InternalChatGateway],
  exports: [InternalChatService, InternalChatGateway],
})
export class InternalChatModule {}
