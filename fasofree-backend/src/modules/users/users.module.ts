import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UsersCommand } from './users.command';
import { UploadModule } from '../upload/upload.module';
import { BanRequest } from './entities/ban-request.entity';
import { BanRequestService } from './ban-request.service';
import { BanRequestController } from './ban-request.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, BanRequest]),
    UploadModule,
    NotificationsModule,
  ],
  controllers: [UsersController, BanRequestController],
  providers: [UsersService, UsersCommand, BanRequestService],
  exports: [UsersService, UsersCommand, BanRequestService],
})
export class UsersModule {}
