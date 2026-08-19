import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY', '');
    this.fromEmail = this.configService.get<string>(
      'RESEND_FROM_EMAIL',
      'FasoFree <noreply@fasofree.bf>',
    );

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('[Email] Resend SDK initialisé');
    } else {
      this.resend = null;
      this.logger.warn('[Email] RESEND_API_KEY manquant — email en mode dev (log uniquement)');
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    if (!this.resend) {
      this.logger.log(`[Email Dev] À: ${to} | Sujet: ${subject}`);
      this.logger.log(`[Email Dev] Contenu: ${html.replace(/<[^>]*>/g, '').slice(0, 200)}`);
      return false;
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: [to],
        subject,
        html,
      });
      this.logger.log(`[Email] Envoyé à ${to} — Sujet: ${subject}`);
      return true;
    } catch (error) {
      this.logger.error(`[Email Error] Échec envoi à ${to}: ${error.message}`);
      return false;
    }
  }

  async sendApprovalEmail(
    email: string,
    userName: string,
    role: string,
    tempPassword: string,
  ): Promise<boolean> {
    const roleLabel = role === 'DRIVER' ? 'Livreur' : 'Marchand';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #C1652E; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🎉 Bienvenue sur FasoFree !</h1>
        </div>
        <div style="background: #FAF6F1; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Bonjour <strong>${userName}</strong>,</p>
          <p>Félicitations ! Votre candidature de <strong>${roleLabel}</strong> a été <strong style="color: #5C6B3C;">approuvée</strong>.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #E8E0D8;">
            <p style="margin: 0 0 10px 0;"><strong>Email :</strong> ${email}</p>
            <p style="margin: 0;"><strong>Mot de passe temporaire :</strong> <code style="background: #f4f4f4; padding: 2px 6px; border-radius: 4px; color: #C1652E; font-weight: bold;">${tempPassword}</code></p>
          </div>
          <p>Connectez-vous dès maintenant et modifiez votre mot de passe depuis votre profil.</p>
          <a href="https://fasofree-9udt.vercel.app" style="display: inline-block; background: #C1652E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Accéder au Dashboard</a>
        </div>
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">© FasoFree — Marketplace & Livraison, Ouagadougou</p>
      </div>
    `;
    return this.sendEmail(email, `FasoFree — Votre compte ${roleLabel} est approuvé !`, html);
  }

  async sendRejectionEmail(
    email: string,
    userName: string,
    role: string,
    reason: string,
  ): Promise<boolean> {
    const roleLabel = role === 'DRIVER' ? 'Livreur' : 'Marchand';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #70645C; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">FasoFree — Mise à jour de votre candidature</h1>
        </div>
        <div style="background: #FAF6F1; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Bonjour <strong>${userName}</strong>,</p>
          <p>Votre candidature de <strong>${roleLabel}</strong> a été <strong style="color: #C44D56;">refusée</strong>.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #E8E0D8;">
            <p style="margin: 0 0 10px 0;"><strong>Motif du refus :</strong></p>
            <p style="margin: 0; color: #70645C;">${reason}</p>
          </div>
          <p>Vous pouvez corriger les éléments signalés et soumettre une nouvelle candidature.</p>
          <a href="https://fasofree-9udt.vercel.app/auth" style="display: inline-block; background: #C1652E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Soumettre une nouvelle candidature</a>
        </div>
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">© FasoFree — Marketplace & Livraison, Ouagadougou</p>
      </div>
    `;
    return this.sendEmail(email, `FasoFree — Votre candidature ${roleLabel} a été refusée`, html);
  }

  async sendOtpEmail(
    email: string,
    userName: string,
    code: string,
  ): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #C1652E; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Code de vérification FasoFree</h1>
        </div>
        <div style="background: #FAF6F1; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Bonjour <strong>${userName}</strong>,</p>
          <p>Voici votre code de vérification :</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #E8E0D8; text-align: center;">
            <p style="margin: 0; font-size: 32px; font-weight: bold; color: #C1652E; letter-spacing: 8px;">${code}</p>
          </div>
          <p style="color: #70645C; font-size: 14px;">Ce code expire dans <strong>5 minutes</strong>.</p>
          <p style="color: #70645C; font-size: 14px;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
        </div>
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">© FasoFree — Marketplace & Livraison, Ouagadougou</p>
      </div>
    `;
    return this.sendEmail(email, 'FasoFree — Votre code de vérification', html);
  }
}
