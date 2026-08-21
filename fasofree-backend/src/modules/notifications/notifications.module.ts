import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirebaseAdminProvider } from './providers/firebase-admin.provider';
import { NotificationsService } from './notifications.service';
import { NotificationStoreService } from './notification-store.service';
import { Notification } from './entities/notification.entity';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import { WhatsAppService } from './whatsapp.service';
import { NotificationsController } from './notifications.controller';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Notification]),
    forwardRef(() => UsersModule),
  ],
  controllers: [NotificationsController, WhatsAppWebhookController],
  providers: [
    FirebaseAdminProvider,
    NotificationsService,
    NotificationStoreService,
    SmsService,
    EmailService,
    WhatsAppService,
  ],
  exports: [NotificationsService, NotificationStoreService, SmsService, EmailService, WhatsAppService],
})
export class NotificationsModule {}
