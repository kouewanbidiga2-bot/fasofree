import { Module } from '@nestjs/common';
import { FirebaseAdminProvider } from './providers/firebase-admin.provider';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [NotificationsController],
  providers: [FirebaseAdminProvider, NotificationsService],
  exports: [NotificationsService], // Exporté pour être réutilisé dans OrdersModule
})
export class NotificationsModule {}
