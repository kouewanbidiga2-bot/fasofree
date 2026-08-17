import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseAdminProvider } from './providers/firebase-admin.provider';
import { NotificationsService } from './notifications.service';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import { WhatsAppService } from './whatsapp.service';
import { NotificationsController } from './notifications.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ConfigModule, UsersModule],
  controllers: [NotificationsController],
  providers: [
    FirebaseAdminProvider,
    NotificationsService,
    SmsService,
    EmailService,
    WhatsAppService,
  ],
  exports: [NotificationsService, SmsService, EmailService, WhatsAppService],
})
export class NotificationsModule {}
