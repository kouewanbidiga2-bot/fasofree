/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getMessaging } from 'firebase-admin/messaging';
import { getApps } from 'firebase-admin/app';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import { WhatsAppService } from './whatsapp.service';
import { User, NotificationChannel } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

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
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  // ─── NOTIFICATIONS (PUSH FCM UNIQUEMENT) ────────────────────────────────────

  /**
   * Envoie UNIQUEMENT un push FCM à l'utilisateur (si un token existe).
   *
   * ⚠️ Règle plateforme (définitive) : les notifications du flux in-app ne
   * passent JAMAIS par e-mail / SMS / WhatsApp. Elles sont déposées en base
   * (centre de notifications → cloche) par `NotificationStoreService` et, le
   * cas échéant, poussées via FCM — exactement comme les notifications
   * YouTube / WhatsApp.
   *
   * Les e-mails restent réservés aux messages TRANSACTIONNELS qui ne sont pas
   * des notifications du flux : OTP, approbation / refus de compte (avec
   * identifiants), reset de mot de passe (voir `sendApprovalNotification`,
   * `sendRejectionNotification`, `EmailService`).
   */
  async sendPushNotification(
    user: User,
    subject: string,
    message: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!user?.fcmToken) return false;
    return this.sendToDevice(user.fcmToken, { title: subject, body: message, data });
  }

  /**
   * Notifications d'approbation : envoie via le canal préféré + push FCM.
   *
   * Repli échelonné — les identifiants ne doivent JAMAIS être perdus
   * silencieusement : si le canal préféré échoue (non configuré, numéro ou
   * e-mail absent, erreur réseau), on retente le SMS puis l'e-mail
   * transactionnel (autorisé par la règle plateforme).
   */
  async sendApprovalNotification(
    user: User,
    tempPassword: string,
  ): Promise<void> {
    const roleLabel = user.applicationType === 'DRIVER' ? 'Livreur' : 'Marchand';
    const channel = user.preferredNotificationChannel || NotificationChannel.EMAIL;
    const userName = user.fullName || 'Utilisateur';
    const appType = user.applicationType || 'MERCHANT';
    const phone = user.phone;
    const email = user.email;

    // 📧 EMAIL de confirmation TOUJOURS envoyé (exigence plateforme) :
    // - Livreur  : email d'approbation garanti, quel que soit le canal préféré.
    // - Marchand : pas de doublon — il reçoit déjà l'email de bienvenue enrichi
    //   (avec lien vers son dashboard) dans le flux d'approbation (onboarding).
    let emailOk = true;
    if (appType !== 'MERCHANT' && email) {
      emailOk = await this.sendEmailSafe(() =>
        this.emailService.sendApprovalEmail(email, userName, appType, tempPassword),
      );
    }

    const smsText =
      `FasoFree: Bienvenue ! Votre compte ${roleLabel} est approuvé. ` +
      `Mot de passe temporaire: ${tempPassword}. Connectez-vous et changez-le.`;

    // 1. Canal préféré — chaque envoi retourne un booléen de remise.
    let delivered = false;
    switch (channel) {
      case NotificationChannel.PUSH: {
        if (user.fcmToken) {
          delivered = await this.sendToDevice(user.fcmToken, {
            title: `Compte ${roleLabel} approuvé !`,
            body: `Bienvenue sur FasoFree ! Connectez-vous avec votre mot de passe temporaire.`,
            data: { type: 'ONBOARDING_APPROVED', role: appType },
          });
        }
        break;
      }
      case NotificationChannel.EMAIL: {
        // Déjà tenté ci-dessus (email garanti / doublon marchand évité).
        delivered = emailOk;
        break;
      }
      case NotificationChannel.WHATSAPP: {
        if (phone) {
          try {
            delivered = await this.whatsappService.sendApprovalMessage(
              phone,
              userName,
              appType,
              tempPassword,
              email || undefined,
            );
          } catch (err) {
            this.logger.warn(
              `[Notifications] Échec WhatsApp approbation: ${(err as Error).message}`,
            );
          }
        }
        break;
      }
      case NotificationChannel.SMS:
      default: {
        delivered = await this.sendSmsSafe(phone, smsText);
        break;
      }
    }

    // Replis : SMS d'abord (le canal choisi était un messagerie), puis e-mail.
    if (!delivered && channel !== NotificationChannel.SMS) {
      delivered = await this.sendSmsSafe(phone, smsText);
    }
    if (!delivered && channel !== NotificationChannel.EMAIL && email) {
      delivered = await this.sendEmailSafe(() =>
        this.emailService.sendApprovalEmail(email, userName, appType, tempPassword),
      );
    }
    if (!delivered) {
      this.logger.warn(
        `[Notifications] Approbation ${roleLabel} de ${user.id} non remise (canal=${channel}).`,
      );
    }

    // 2. Push FCM en complément — fire-and-forget (le canal principal a déjà réussi)
    if (channel !== NotificationChannel.PUSH && user.fcmToken) {
      this.sendToDevice(user.fcmToken, {
        title: `Compte ${roleLabel} approuvé !`,
        body: `Bienvenue sur FasoFree ! Connectez-vous avec votre mot de passe temporaire.`,
        data: { type: 'ONBOARDING_APPROVED', role: appType },
      }).catch(() => {});
    }
  }

  /**
   * Notifications de refus : envoie via le canal préféré + push FCM.
   * Même principe de repli que l'approbation : SMS puis e-mail si le canal
   * préféré échoue — le refus ne doit pas rester silencieux.
   */
  async sendRejectionNotification(
    user: User,
    reason: string,
  ): Promise<void> {
    const roleLabel = user.applicationType === 'DRIVER' ? 'Livreur' : 'Marchand';
    const channel = user.preferredNotificationChannel || NotificationChannel.EMAIL;
    const userName = user.fullName || 'Utilisateur';
    const appType = user.applicationType || 'MERCHANT';
    const phone = user.phone;
    const email = user.email;

    const smsText =
      `FasoFree: Votre candidature ${roleLabel} a été refusée. ` +
      `Motif: ${reason}. Vous pouvez soumettre une nouvelle candidature.`;

    let delivered = false;
    switch (channel) {
      case NotificationChannel.PUSH: {
        if (user.fcmToken) {
          delivered = await this.sendToDevice(user.fcmToken, {
            title: `Candidature ${roleLabel} refusée`,
            body: reason,
            data: { type: 'ONBOARDING_REJECTED', role: appType, reason },
          });
        }
        break;
      }
      case NotificationChannel.EMAIL: {
        if (email) {
          delivered = await this.sendEmailSafe(() =>
            this.emailService.sendRejectionEmail(email, userName, appType, reason),
          );
        }
        break;
      }
      case NotificationChannel.WHATSAPP: {
        if (phone) {
          try {
            delivered = await this.whatsappService.sendRejectionMessage(
              phone,
              userName,
              appType,
              reason,
            );
          } catch (err) {
            this.logger.warn(
              `[Notifications] Échec WhatsApp refus: ${(err as Error).message}`,
            );
          }
        }
        break;
      }
      case NotificationChannel.SMS:
      default: {
        delivered = await this.sendSmsSafe(phone, smsText);
        break;
      }
    }

    if (!delivered && channel !== NotificationChannel.SMS) {
      delivered = await this.sendSmsSafe(phone, smsText);
    }
    if (!delivered && channel !== NotificationChannel.EMAIL && email) {
      delivered = await this.sendEmailSafe(() =>
        this.emailService.sendRejectionEmail(email, userName, appType, reason),
      );
    }
    if (!delivered) {
      this.logger.warn(
        `[Notifications] Refus ${roleLabel} de ${user.id} non remis (canal=${channel}).`,
      );
    }

    // Push FCM en complément — fire-and-forget
    if (channel !== NotificationChannel.PUSH && user.fcmToken) {
      this.sendToDevice(user.fcmToken, {
        title: `Candidature ${roleLabel} refusée`,
        body: reason,
        data: { type: 'ONBOARDING_REJECTED', role: appType },
      }).catch(() => {});
    }
  }

  /** Envoi SMS protégé : retourne false si échec / numéro absent (repli possible). */
  private async sendSmsSafe(
    phone: string | null | undefined,
    message: string,
  ): Promise<boolean> {
    if (!phone) return false;
    try {
      return await this.smsService.sendSms(phone, message);
    } catch (err) {
      this.logger.warn(
        `[Notifications] Échec SMS vers ${phone}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /** Envoi e-mail transactionnel protégé : retourne false si échec / rejet. */
  private async sendEmailSafe(run: () => Promise<boolean>): Promise<boolean> {
    try {
      return await run();
    } catch (err) {
      this.logger.warn(
        `[Notifications] Échec email transactionnel: ${(err as Error).message}`,
      );
      return false;
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
          fcmOptions: { link: this.buildWebpushLink(payload.data?.orderId) },
        },
      });

      this.logger.debug(`[Push] Envoyé à ${fcmToken.slice(0, 12)}…`);
      return true;
    } catch (error: any) {
      // Tokens invalides/expirés : FCM rejette avec ces codes
      const invalidCodes = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];
      if (invalidCodes.includes(error?.code)) {
        this.logger.warn(`[Push] Token FCM invalide/expiré: ${fcmToken.slice(0, 12)}… — nettoyage en cours`);
        this.usersService.clearFcmToken(fcmToken).catch(() => {});
      } else {
        this.logger.error(`[Push] Échec envoi: ${error.message}`);
      }
      return false;
    }
  }

  /**
   * 🔗 Construit le lien de clic d'une notification webpush.
   *
   * `webpush.fcmOptions.link` DOIT être une URL absolue en HTTPS — doc FCM
   * officielle (projects.messages, WebpushFcmOptions) : « For all URL values,
   * HTTPS is required ». On envoyait auparavant un lien RELATIF ("/",
   * "/order-tracking?id=…") : valeur invalide rejetée/neutralisée par FCM.
   * On construit donc depuis `CLIENT_URL` (défaut : domaine client canonique).
   */
  private buildWebpushLink(orderId?: string): string {
    const base = (
      this.configService.get<string>('CLIENT_URL') || 'https://www.fasofree.site'
    ).replace(/\/+$/, '');
    return orderId ? `${base}/order-tracking?id=${orderId}` : `${base}/`;
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

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private wrapHtml(subject: string, message: string): string {
    const safeSubject = this.escapeHtml(subject);
    const safeMessage = this.escapeHtml(message);
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #C1652E; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">${safeSubject}</h1>
        </div>
        <div style="background: #FAF6F1; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="white-space: pre-line;">${safeMessage}</p>
        </div>
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">© FasoFree — Marketplace & Livraison, Ouagadougou</p>
      </div>
    `;
  }
}
