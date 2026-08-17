import { Injectable, Logger } from '@nestjs/common';
import { getMessaging } from 'firebase-admin/messaging';
import { getApps } from 'firebase-admin/app';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import { WhatsAppService } from './whatsapp.service';
import { User, NotificationChannel } from '../users/entities/user.entity';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  // ─── DISPATCHER MULTI-CANAUX ────────────────────────────────────────────────

  /**
   * Envoie une notification via le canal préféré de l'utilisateur.
   * Fallback : si le canal principal échoue, essaie les autres.
   */
  async sendNotification(
    user: User,
    subject: string,
    message: string,
  ): Promise<boolean> {
    const channel = user.preferredNotificationChannel || NotificationChannel.EMAIL;

    switch (channel) {
      case NotificationChannel.EMAIL:
        if (user.email) {
          const ok = await this.emailService.sendEmail(user.email, subject, this.wrapHtml(subject, message));
          if (ok) return true;
        }
        // Fallback → SMS
        if (user.phone) {
          return this.smsService.sendSms(user.phone, `${subject}: ${message}`);
        }
        return false;

      case NotificationChannel.WHATSAPP:
        if (user.phone) {
          const ok = await this.whatsappService.sendTextMessage(user.phone, `*${subject}*\n\n${message}`);
          if (ok) return true;
        }
        // Fallback → Email
        if (user.email) {
          return this.emailService.sendEmail(user.email, subject, this.wrapHtml(subject, message));
        }
        return false;

      case NotificationChannel.SMS:
      default:
        if (user.phone) {
          const ok = await this.smsService.sendSms(user.phone, `${subject}: ${message}`);
          if (ok) return true;
        }
        // Fallback → Email
        if (user.email) {
          return this.emailService.sendEmail(user.email, subject, this.wrapHtml(subject, message));
        }
        return false;
    }
  }

  /**
   * Notifications d'approvision : envoie via le canal préféré + push FCM.
   */
  async sendApprovalNotification(
    user: User,
    tempPassword: string,
  ): Promise<void> {
    const roleLabel = user.applicationType === 'DRIVER' ? 'Livreur' : 'Marchand';
    const channel = user.preferredNotificationChannel || NotificationChannel.EMAIL;

    const userName = user.fullName || 'Utilisateur';
    const appType = user.applicationType || 'MERCHANT';

    // 1. Canal préféré
    switch (channel) {
      case NotificationChannel.EMAIL: {
        const email = user.email;
        if (email) {
          await this.emailService.sendApprovalEmail(
            email, userName, appType, tempPassword,
          );
        }
        break;
      }
      case NotificationChannel.WHATSAPP: {
        const phone = user.phone;
        if (phone) {
          await this.whatsappService.sendApprovalMessage(
            phone, userName, appType, tempPassword,
          );
        }
        break;
      }
      case NotificationChannel.SMS:
      default: {
        const phone = user.phone;
        if (phone) {
          await this.smsService.sendSms(
            phone,
            `FasoFree: Bienvenue ! Votre compte ${roleLabel} est approuvé. Mot de passe temporaire: ${tempPassword}. Connectez-vous et changez-le.`,
          );
        }
        break;
      }
    }

    // 2. Push FCM en complément
    if (user.fcmToken) {
      await this.sendToDevice(user.fcmToken, {
        title: `🎉 Compte ${roleLabel} approuvé !`,
        body: `Bienvenue sur FasoFree ! Connectez-vous avec votre mot de passe temporaire.`,
      });
    }
  }

  /**
   * Notifications de refus : envoie via le canal préféré.
   */
  async sendRejectionNotification(
    user: User,
    reason: string,
  ): Promise<void> {
    const roleLabel = user.applicationType === 'DRIVER' ? 'Livreur' : 'Marchand';
    const channel = user.preferredNotificationChannel || NotificationChannel.EMAIL;
    const userName = user.fullName || 'Utilisateur';
    const appType = user.applicationType || 'MERCHANT';

    switch (channel) {
      case NotificationChannel.EMAIL: {
        const email = user.email;
        if (email) {
          await this.emailService.sendRejectionEmail(
            email, userName, appType, reason,
          );
        }
        break;
      }
      case NotificationChannel.WHATSAPP: {
        const phone = user.phone;
        if (phone) {
          await this.whatsappService.sendRejectionMessage(
            phone, userName, appType, reason,
          );
        }
        break;
      }
      case NotificationChannel.SMS:
      default: {
        const phone = user.phone;
        if (phone) {
          await this.smsService.sendSms(
            phone,
            `FasoFree: Votre candidature ${roleLabel} a été refusée. Motif: ${reason}. Vous pouvez soumettre une nouvelle candidature.`,
          );
        }
        break;
      }
    }

    // Push FCM
    if (user.fcmToken) {
      await this.sendToDevice(user.fcmToken, {
        title: `Candidature ${roleLabel} refusée`,
        body: reason,
      });
    }
  }

  // ─── PUSH FCM (EXISTANT) ───────────────────────────────────────────────────

  async sendWelcomeCredentials(
    user: User,
    tempPassword: string,
  ): Promise<void> {
    // Rediriger vers le nouveau système multi-canaux
    await this.sendApprovalNotification(user, tempPassword);
  }

  async sendToDevice(fcmToken: string, payload: PushPayload): Promise<boolean> {
    if (!fcmToken) return false;
    try {
      if (getApps().length > 0) {
        await getMessaging().send({
          token: fcmToken,
          notification: { title: payload.title, body: payload.body },
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
          notification: { title: payload.title, body: payload.body },
          data: payload.data || {},
        });
      }
      return true;
    } catch (error) {
      this.logger.error(`Échec d'envoi vers le topic ${topic}:`, error);
      return false;
    }
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  private wrapHtml(subject: string, message: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #C1652E; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">${subject}</h1>
        </div>
        <div style="background: #FAF6F1; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="white-space: pre-line;">${message}</p>
        </div>
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">© FasoFree — Marketplace & Livraison, Ouagadougou</p>
      </div>
    `;
  }
}
