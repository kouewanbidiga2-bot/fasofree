import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN', '');
    this.phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID', '');
    this.apiUrl = `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`;

    if (this.accessToken && this.phoneNumberId) {
      this.logger.log('[WhatsApp] Meta Cloud API configuré');
    } else {
      this.logger.warn('[WhatsApp] Credentials manquants — WhatsApp en mode dev (log uniquement)');
    }
  }

  private isConfigured(): boolean {
    return !!(this.accessToken && this.phoneNumberId);
  }

  async sendTextMessage(to: string, text: string): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.log(`[WhatsApp Dev] À: ${to} | Message: ${text.slice(0, 200)}`);
      return false;
    }

    // Normaliser le numéro : retirer espaces, tirets, parenthèses
    const normalizedPhone = to.replace(/[\s\-()]/g, '');
    const phone = normalizedPhone.startsWith('+')
      ? normalizedPhone.substring(1)
      : normalizedPhone.startsWith('226')
        ? normalizedPhone
        : '226' + normalizedPhone;

    try {
      const axios = require('axios');
      const response = await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'text',
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data?.messages?.[0]?.id) {
        this.logger.log(`[WhatsApp] Message envoyé à ${phone}`);
        return true;
      }

      this.logger.warn(`[WhatsApp] Réponse inattendue: ${JSON.stringify(response.data)}`);
      return false;
    } catch (error) {
      const errMsg = error.response?.data?.error?.message || error.message;
      this.logger.error(`[WhatsApp Error] Échec envoi à ${phone}: ${errMsg}`);
      return false;
    }
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    parameters: { type: string; text: string }[],
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.log(`[WhatsApp Dev] Template: ${templateName} à ${to}`);
      return false;
    }

    const normalizedPhone = to.replace(/[\s\-()]/g, '');
    const phone = normalizedPhone.startsWith('+')
      ? normalizedPhone.substring(1)
      : normalizedPhone.startsWith('226')
        ? normalizedPhone
        : '226' + normalizedPhone;

    try {
      const axios = require('axios');
      const response = await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components: [
              {
                type: 'body',
                parameters,
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data?.messages?.[0]?.id) {
        this.logger.log(`[WhatsApp] Template envoyé à ${phone}: ${templateName}`);
        return true;
      }
      return false;
    } catch (error) {
      const errMsg = error.response?.data?.error?.message || error.message;
      this.logger.error(`[WhatsApp Error] Template échoué à ${phone}: ${errMsg}`);
      return false;
    }
  }

  async sendApprovalMessage(
    phone: string,
    userName: string,
    role: string,
    tempPassword: string,
  ): Promise<boolean> {
    const roleLabel = role === 'DRIVER' ? 'Livreur' : 'Marchand';
    const text =
      `🎉 *Bienvenue sur FasoFree !*\n\n` +
      `Bonjour ${userName},\n\n` +
      `Félicitations ! Votre candidature de *${roleLabel}* a été *approuvée*.\n\n` +
      `📧 Email : (votre email)\n` +
      `🔑 Mot de passe temporaire : *${tempPassword}*\n\n` +
      `Connectez-vous dès maintenant et changez votre mot de passe.\n\n` +
      `👉 https://fasofree-admin.onrender.com`;
    return this.sendTextMessage(phone, text);
  }

  async sendRejectionMessage(
    phone: string,
    userName: string,
    role: string,
    reason: string,
  ): Promise<boolean> {
    const roleLabel = role === 'DRIVER' ? 'Livreur' : 'Marchand';
    const text =
      `FasoFree — Mise à jour de votre candidature\n\n` +
      `Bonjour ${userName},\n\n` +
      `Votre candidature de *${roleLabel}* a été *refusée*.\n\n` +
      `📋 Motif : ${reason}\n\n` +
      `Vous pouvez corriger et soumettre une nouvelle candidature.\n\n` +
      `👉 https://fasofree-admin.onrender.com`;
    return this.sendTextMessage(phone, text);
  }
}
