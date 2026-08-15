import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module'; // Nécessaire pour récupérer l'Ordre et son fcmToken

@Module({
  imports: [NotificationsModule, OrdersModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
