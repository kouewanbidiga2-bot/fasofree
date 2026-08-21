import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UsersCommand } from './users.command';
import { UploadModule } from '../upload/upload.module';
import { BanRequest } from './entities/ban-request.entity';
import { BanRequestService } from './ban-request.service';
import { BanRequestController } from './ban-request.controller';
import { Favorite } from './entities/favorite.entity';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, BanRequest, Favorite]),
    UploadModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [UsersController, BanRequestController, FavoritesController],
  providers: [UsersService, UsersCommand, BanRequestService, FavoritesService],
  exports: [UsersService, UsersCommand, BanRequestService, FavoritesService],
})
export class UsersModule {}
