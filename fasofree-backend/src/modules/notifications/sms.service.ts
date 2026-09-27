import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 📱 Interface générique pour les providers SMS
 */
export interface SmsProvider {
  sendSms(phoneNumber: string, message: string): Promise<boolean>;
}

/**
 * 📦 Implémentation Twilio
 */
class TwilioProvider implements SmsProvider {
  private readonly logger = new Logger(TwilioProvider.name);
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(configService: ConfigService) {
    this.accountSid = configService.get<string>('TWILIO_ACCOUNT_SID', '');
    this.authToken = configService.get<string>('TWILIO_AUTH_TOKEN', '');
    this.fromNumber = configService.get<string>('TWILIO_PHONE_NUMBER', '');
  }

  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      this.logger.warn('[Twilio] Credentials non configurés - SMS non envoyé');
      return false;
    }

    try {
      // Implémentation réelle avec Twilio
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Dépendance optionnelle (pas dans package.json)
      const twilio = require('twilio');
      const client = twilio(this.accountSid, this.authToken);

      await client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber,
      });

      this.logger.log(`[Twilio] SMS envoyé avec succès à ${phoneNumber}`);
      return true;
    } catch (error) {
      this.logger.error(`[Twilio Error] ${error.message}`);
      return false;
    }
  }
}

/**
 * 📦 Implémentation Africa's Talking
 */
class AfricasTalkingProvider implements SmsProvider {
  private readonly logger = new Logger(AfricasTalkingProvider.name);
  private username: string;
  private apiKey: string;
  private senderId: string;

  constructor(configService: ConfigService) {
    this.username = configService.get<string>('AFRICASTALKING_USERNAME', '');
    this.apiKey = configService.get<string>('AFRICASTALKING_API_KEY', '');
    this.senderId = configService.get<string>(
      'AFRICASTALKING_SENDER_ID',
      'FasoFree',
    );
  }

  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.username || !this.apiKey) {
      this.logger.warn(
        "[Africa's Talking] Credentials non configurés - SMS non envoyé",
      );
      return false;
    }

    try {
      // Implémentation réelle avec Africa's Talking
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Requis dans ce contexte (provider)
      const axios = require('axios');
      const url = 'https://api.africastalking.com/version1/messaging';

      const response = await axios.post(
        url,
        {
          username: this.username,
          to: phoneNumber,
          message: message,
          from: this.senderId,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            apiKey: this.apiKey,
          },
        },
      );

      if (response.data?.SMSMessageData?.Recipients?.[0]?.statusCode === 100) {
        this.logger.log(
          `[Africa's Talking] SMS envoyé avec succès à ${phoneNumber}`,
        );
        return true;
      } else {
        // 🔐 En dehors du dev, ne jamais exposer le contenu (les codes OTP transitent ici).
        if (process.env.NODE_ENV !== 'development') {
          this.logger.error(
            `[Africa's Talking] Échec envoi SMS (contenu masqué, ` +
              `clés=${Object.keys(response.data ?? {}).join(',') || 'aucune'})`,
          );
        } else {
          this.logger.error(
            `[Africa's Talking] Échec envoi SMS: ${JSON.stringify(response.data)}`,
          );
        }
        return false;
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'development') {
        this.logger.error(
          `[Africa's Talking Error] (contenu masqué, ` +
            `type=${error?.constructor?.name ?? 'inconnu'})`,
        );
      } else {
        this.logger.error(
          `[Africa's Talking Error] ${String(error?.message ?? '').slice(0, 500)}`,
        );
      }
      return false;
    }
  }
}

/**
 * 📦 Implémentation TextBee (textbee.dev) — passerelle SMS Android
 */
class TextbeeProvider implements SmsProvider {
  private readonly logger = new Logger(TextbeeProvider.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.textbee.dev/api/v1/gateway/send-sms';

  constructor(configService: ConfigService) {
    this.apiKey = configService.get<string>('TEXTBEE_API_KEY', '');
  }

  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn('[TextBee] Clé API non configurée - SMS non envoyé');
      return false;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- axios importé via require pour cohérence avec les autres providers
      const axios = require('axios');
      const response = await axios.post(
        this.apiUrl,
        {
          recipients: [phoneNumber],
          message,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          timeout: 10000,
        },
      );

      // 200 : seul `data` est garanti par l'API. Ses champs dépendent du mode de dispatch :
      //   - file d'attente   : { data: { success: true, smsBatchId, recipientCount } }
      //   - dispatch immédiat: { data: { successCount, failureCount } }  (sans `success`)
      const payload = response.data;
      const result = payload?.data;

      const queuedOk = result?.success === true;
      const immediateOk =
        typeof result?.successCount === 'number' &&
        result.successCount > 0 &&
        (result.failureCount ?? 0) === 0;

      if (queuedOk || immediateOk) {
        this.logger.log(
          `[TextBee] SMS accepté par textbee pour ${phoneNumber}`,
        );
        return true;
      }

      // Échec applicatif (ex: aucun appareil TextBee connecté, échec de push)
      // 🔐 Le détail de la passerelle peut reprendre le SMS envoyé (code OTP) :
      //    en dehors du dev, on ne loggue que la FORME de la réponse, jamais son contenu.
      if (process.env.NODE_ENV !== 'development') {
        this.logger.error(
          `[TextBee] Échec envoi SMS (contenu masqué, ` +
            `clés=${Object.keys(payload ?? {}).join(',') || 'aucune'})`,
        );
      } else {
        const detail =
          result?.message ||
          result?.error ||
          payload?.message ||
          payload?.error;
        this.logger.error(
          `[TextBee] Échec envoi SMS: ${detail || JSON.stringify(payload ?? null)}`,
        );
      }
      return false;
    } catch (error) {
      // 4xx/5xx HTTP : remonter le code pour orienter le débogage (ex: 400 = device absent)
      const status = error?.response?.status ?? '';
      const body = error?.response?.data;
      if (process.env.NODE_ENV !== 'development') {
        this.logger.error(
          `[TextBee Error] ${status} (contenu masqué, ` +
            `clés=${Object.keys(body ?? {}).join(',') || 'aucune'})`,
        );
      } else {
        const apiError = body?.error || body?.message || error?.message;
        this.logger.error(
          `[TextBee Error] ${status} ${String(apiError ?? '').slice(0, 500)}`,
        );
      }
      return false;
    }
  }
}

/**
 * 📦 Implémentation SMS fallback (logs only)
 */
class FallbackSmsProvider implements SmsProvider {
  private readonly logger = new Logger(FallbackSmsProvider.name);

  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'development') {
      this.logger.warn(
        `[SMS Fallback] SMS non envoyé (mode dev): ${phoneNumber} - ${message}`,
      );
    } else {
      // 🔐 Hors dev : jamais le contenu (codes OTP / mots de passe temporaires) dans les logs.
      this.logger.warn(
        `[SMS Fallback] SMS non envoyé (${process.env.NODE_ENV ?? 'NODE_ENV absent'} — ` +
          `canal non configuré, contenu masqué): ${phoneNumber}`,
      );
    }
    return false;
  }
}

/**
 * 📱 Service SMS générique avec fallback
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private provider: SmsProvider;

  constructor(private readonly configService: ConfigService) {
    const providerType = this.configService.get<string>(
      'SMS_PROVIDER',
      'fallback',
    );

    switch (providerType) {
      case 'twilio':
        this.provider = new TwilioProvider(this.configService);
        break;
      case 'africastalking':
        this.provider = new AfricasTalkingProvider(this.configService);
        break;
      case 'textbee':
        this.provider = new TextbeeProvider(this.configService);
        break;
      default:
        this.provider = new FallbackSmsProvider();
    }

    this.logger.log(`[SMS Service] Provider initialisé: ${providerType}`);
  }

  /**
   * 📤 Envoyer un SMS
   */
  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    try {
      // Normaliser le numéro de téléphone (ajouter +226 si absent)
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      const success = await this.provider.sendSms(normalizedPhone, message);

      if (success) {
        this.logger.log(`[SMS] SMS envoyé avec succès à ${normalizedPhone}`);
      } else {
        this.logger.warn(`[SMS] Échec de l'envoi du SMS à ${normalizedPhone}`);
      }

      return success;
    } catch (error) {
      this.logger.error(
        `[SMS Error] Erreur lors de l'envoi du SMS: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * 📱 Envoyer un SMS de confirmation de commande
   */
  async sendOrderConfirmationSms(
    phoneNumber: string,
    orderId: string,
    totalAmount: number,
  ): Promise<boolean> {
    const message = `FasoFree: Votre commande #${orderId.slice(-8)} a été confirmée. Total: ${totalAmount} FCFA. Suivez votre commande sur l'app.`;
    return this.sendSms(phoneNumber, message);
  }

  /**
   * 📱 Envoyer un SMS de notification de livraison
   */
  async sendDeliveryNotificationSms(
    phoneNumber: string,
    orderId: string,
  ): Promise<boolean> {
    const message = `FasoFree: Votre livreur est en route avec votre commande #${orderId.slice(-8)}. Préparez-vous!`;
    return this.sendSms(phoneNumber, message);
  }

  /**
   * 📱 Envoyer un SMS d'alerte urgente
   */
  async sendUrgentAlertSms(
    phoneNumber: string,
    subject: string,
    message: string,
  ): Promise<boolean> {
    const fullMessage = `URGENT - ${subject}: ${message}`;
    return this.sendSms(phoneNumber, fullMessage);
  }

  /**
   * 🔢 Normaliser le numéro de téléphone (format international Burkina Faso)
   */
  private normalizePhoneNumber(phone: string): string {
    let normalized = phone.replace(/\s/g, '').replace(/[-()]/g, '');

    // Si le numéro commence par 0, ajouter +226
    if (normalized.startsWith('0')) {
      normalized = '+226' + normalized.substring(1);
    }
    // Si le numéro commence par 226 (sans +), ajouter +
    else if (normalized.startsWith('226')) {
      normalized = '+' + normalized;
    }
    // Si le numéro n'a pas de préfixe international, ajouter +226
    else if (!normalized.startsWith('+')) {
      normalized = '+226' + normalized;
    }

    return normalized;
  }
}
