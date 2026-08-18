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
   * Si fcmToken présent, push FCM envoyé en parallèle (toujours).
   * Fallback : si le canal principal échoue, essaie les autres.
   */
  async sendNotification(
    user: User,
    subject: string,
    message: string,
  ): Promise<boolean> {
    const channel = user.preferredNotificationChannel || NotificationChannel.EMAIL;
    let channelOk = false;

    // 1. Canal principal
    switch (channel) {
      case NotificationChannel.PUSH: {
        if (user.fcmToken) {
          channelOk = await this.sendToDevice(user.fcmToken, { title: subject, body: message });
        }
        if (!channelOk && user.email) {
          channelOk = await this.emailService.sendEmail(user.email, subject, this.wrapHtml(subject, message));
        }
        break;
      }
      case NotificationChannel.EMAIL: {
        if (user.email) {
          channelOk = await this.emailService.sendEmail(user.email, subject, this.wrapHtml(subject, message));
        }
        if (!channelOk && user.phone) {
          channelOk = await this.smsService.sendSms(user.phone, `${subject}: ${message}`);
        }
        break;
      }
      case NotificationChannel.WHATSAPP: {
        if (user.phone) {
          channelOk = await this.whatsappService.sendTextMessage(user.phone, `*${subject}*\n\n${message}`);
        }
        if (!channelOk && user.email) {
          channelOk = await this.emailService.sendEmail(user.email, subject, this.wrapHtml(subject, message));
        }
        break;
      }
      case NotificationChannel.SMS:
      default: {
        if (user.phone) {
          channelOk = await this.smsService.sendSms(user.phone, `${subject}: ${message}`);
        }
        if (!channelOk && user.email) {
          channelOk = await this.emailService.sendEmail(user.email, subject, this.wrapHtml(subject, message));
        }
        break;
      }
    }

    // 2. Push FCM en parallèle (complément, non bloquant) — sauf si le canal principal EST déjà PUSH
    if (channel !== NotificationChannel.PUSH && user.fcmToken) {
      this.sendToDevice(user.fcmToken, { title: subject, body: message }).catch(() => {});
    }

    return channelOk;
  }

  /**
   * Notifications d'approbation : envoie via le canal préféré + push FCM.
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
      case NotificationChannel.PUSH: {
        if (user.fcmToken) {
          await this.sendToDevice(user.fcmToken, {
            title: `Compte ${roleLabel} approuvé !`,
            body: `Bienvenue sur FasoFree ! Connectez-vous avec votre mot de passe temporaire.`,
            data: { type: 'ONBOARDING_APPROVED', role: appType, tempPassword },
          });
        }
        break;
      }
      case NotificationChannel.EMAIL: {
        const email = user.email;
        if (email) {
          await this.emailService.sendApprovalEmail(email, userName, appType, tempPassword);
        }
        break;
      }
      case NotificationChannel.WHATSAPP: {
        const phone = user.phone;
        if (phone) {
          await this.whatsappService.sendApprovalMessage(phone, userName, appType, tempPassword);
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

    // 2. Push FCM en complément (sauf si le canal principal EST déjà PUSH)
    if (channel !== NotificationChannel.PUSH && user.fcmToken) {
      await this.sendToDevice(user.fcmToken, {
        title: `Compte ${roleLabel} approuvé !`,
        body: `Bienvenue sur FasoFree ! Connectez-vous avec votre mot de passe temporaire.`,
        data: { type: 'ONBOARDING_APPROVED', role: appType },
      });
    }
  }

  /**
   * Notifications de refus : envoie via le canal préféré + push FCM.
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
      case NotificationChannel.PUSH: {
        if (user.fcmToken) {
          await this.sendToDevice(user.fcmToken, {
            title: `Candidature ${roleLabel} refusée`,
            body: reason,
            data: { type: 'ONBOARDING_REJECTED', role: appType, reason },
          });
        }
        break;
      }
      case NotificationChannel.EMAIL: {
        const email = user.email;
        if (email) {
          await this.emailService.sendRejectionEmail(email, userName, appType, reason);
        }
        break;
      }
      case NotificationChannel.WHATSAPP: {
        const phone = user.phone;
        if (phone) {
          await this.whatsappService.sendRejectionMessage(phone, userName, appType, reason);
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

    // Push FCM en complément
    if (channel !== NotificationChannel.PUSH && user.fcmToken) {
      await this.sendToDevice(user.fcmToken, {
        title: `Candidature ${roleLabel} refusée`,
        body: reason,
        data: { type: 'ONBOARDING_REJECTED', role: appType },
      });
    }
  }

  // ─── PUSH FCM ───────────────────────────────────────────────────────────────

  async sendWelcomeCredentials(
    user: User,
    tempPassword: string,
  ): Promise<void> {
    await this.sendApprovalNotification(user, tempPassword);
  }

  /**
   * Envoie un push FCM à un device unique via son token.
   * Gère les tokens invalides/expirés (nettoyage automatique par FCM).
   */
  async sendToDevice(fcmToken: string, payload: PushPayload): Promise<boolean> {
    if (!fcmToken) return false;

    try {
      if (getApps().length === 0) {
        this.logger.warn('[Push] Firebase Admin non initialisé — push ignoré');
        return false;
      }

      await getMessaging().send({
        token: fcmToken,
        notification: { title: payload.title, body: payload.body },
        data: payload.data || {},
        webpush: {
          fcmOptions: { link: payload.data?.orderId ? `/order-tracking?id=${payload.data.orderId}` : '/' },
        },
      });

      this.logger.debug(`[Push] Envoyé à ${fcmToken.slice(0, 12)}…`);
      return true;
    } catch (error: any) {
      // Tokens invalides/expirés : FCM rejette avec ces codes
      const invalidCodes = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];
      if (invalidCodes.includes(error?.code)) {
        this.logger.warn(`[Push] Token FCM invalide/expiré: ${fcmToken.slice(0, 12)}… — suppression recommandée`);
      } else {
        this.logger.error(`[Push] Échec envoi: ${error.message}`);
      }
      return false;
    }
  }

  async sendToTopic(topic: string, payload: PushPayload): Promise<boolean> {
    try {
      if (getApps().length === 0) return false;
      await getMessaging().send({
        topic,
        notification: { title: payload.title, body: payload.body },
        data: payload.data || {},
      });
      return true;
    } catch (error) {
      this.logger.error(`[Push] Échec envoi topic ${topic}:`, error);
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
