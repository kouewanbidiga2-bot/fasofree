import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InternalMessage } from './entities/internal-message.entity';
import { InternalChatService } from './internal-chat.service';
import { InternalChatController } from './internal-chat.controller';
import { InternalChatGateway } from './internal-chat.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([InternalMessage]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get('JWT_SECRET') || 'SUPER_SECRET_KEY_CHANGEME';
        const expiresIn = config.get('JWT_EXPIRES_IN') || '7d';
        return { secret, signOptions: { expiresIn: expiresIn as any } };
      },
    }),
  ],
  controllers: [InternalChatController],
  providers: [InternalChatService, InternalChatGateway],
  exports: [InternalChatService, InternalChatGateway],
})
export class InternalChatModule {}
