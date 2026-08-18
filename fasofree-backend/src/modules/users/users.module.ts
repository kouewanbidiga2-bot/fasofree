import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UsersCommand } from './users.command';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), UploadModule],
  controllers: [UsersController],
  providers: [UsersService, UsersCommand],
  exports: [UsersService, UsersCommand],
})
export class UsersModule {}
