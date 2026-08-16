import { Injectable, Logger } from '@nestjs/common';
import { getMessaging } from 'firebase-admin/messaging';
import { getApps } from 'firebase-admin/app';
import { SmsService } from './sms.service';
import { User } from '../users/entities/user.entity';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly smsService: SmsService) {}

  /**
   * 🎉 Identifiants de bienvenue envoyés à un Marchand / Livreur dont la
   * candidature vient d'être approuvée.
   *
   * ⚠️ En attendant le branchement d'un vrai canal Email/WhatsApp, la méthode
   * affiche le message dans les logs (et tente un SMS via le provider configuré,
   * qui logge aussi en mode fallback/dev).
   */
  async sendWelcomeCredentials(
    user: User,
    tempPassword: string,
  ): Promise<void> {
    const label = user.role === 'driver' ? 'Livreur' : 'Marchand';
    const message = [
      `Bienvenue sur FasoFree !`,
      `Votre dossier ${label} a été approuvé.`,
      `Email : ${user.email}`,
      `Mot de passe temporaire : ${tempPassword}`,
      `Connectez-vous dès maintenant et modifiez votre mot de passe depuis votre profil.`,
    ].join('\n');

    // 📢 Notification cible : visible dans les logs de l'API (channel à brancher)
    console.log(`[Welcome Credentials] ${message}`);

    // 📱 Tentative d'envoi SMS (provider fallback en dev = log uniquement)
    await this.smsService.sendSms(user.phone, message.replace(/\n/g, ' '));
  }

  async sendToDevice(fcmToken: string, payload: PushPayload): Promise<boolean> {
    if (!fcmToken) return false;

    try {
      if (getApps().length > 0) {
        await getMessaging().send({
          token: fcmToken,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data || {},
        });
      }
      return true;
    } catch (error) {
      this.logger.error("Échec d'envoi notification FCM:", error);
      return false;
    }
  }

  async sendToTopic(topic: string, payload: PushPayload): Promise<boolean> {
    try {
      if (getApps().length > 0) {
        await getMessaging().send({
          topic,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data || {},
        });
      }
      return true;
    } catch (error) {
      this.logger.error(`Échec d'envoi vers le topic ${topic}:`, error);
      return false;
    }
  }
}
