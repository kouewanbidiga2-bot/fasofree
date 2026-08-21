import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly smtpTransporter: nodemailer.Transporter | null;
  private readonly fromEmail: string;
  private readonly useSmtp: boolean;

  constructor(private readonly configService: ConfigService) {
    const smtpUser = this.configService.get<string>('SMTP_USER', '');
    const smtpPass = this.configService.get<string>('SMTP_PASS', '');
    this.fromEmail = this.configService.get<string>(
      'RESEND_FROM_EMAIL',
      `"FasoFree" <${smtpUser || 'onboarding@resend.dev'}>`,
    );

    if (smtpUser && smtpPass) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.smtpTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        family: 4,
        auth: { user: smtpUser, pass: smtpPass },
      } as any);
      this.useSmtp = true;
      this.resend = null;
      this.logger.log(`[Email/SMTP] Transporteur Gmail initialisé avec ${smtpUser}`);
    } else {
      this.smtpTransporter = null;
      this.useSmtp = false;
      const apiKey = this.configService.get<string>('RESEND_API_KEY', '');
      if (apiKey) {
        this.resend = new Resend(apiKey);
        this.logger.log('[Email] Resend SDK initialisé (fallback)');
      } else {
        this.resend = null;
        this.logger.warn('[Email] Aucun transporteur email configuré — mode dev (log uniquement)');
      }
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    if (this.useSmtp && this.smtpTransporter) {
      try {
        await this.smtpTransporter.sendMail({
          from: this.fromEmail,
          to,
          subject,
          html,
        });
        this.logger.log(`[Email/Gmail] Envoyé à ${to} — Sujet: ${subject}`);
        return true;
      } catch (error: any) {
        this.logger.error(`[Email/Gmail] Échec envoi à ${to}: ${error.message}`);
        this.logger.log(`[Email/Gmail] Bannière OTP — À: ${to} | Sujet: ${subject}`);
      }
    }

    if (this.resend) {
      try {
        await this.resend.emails.send({
          from: this.fromEmail,
          to: [to],
          subject,
          html,
        });
        this.logger.log(`[Email/Resend] Envoyé à ${to} — Sujet: ${subject}`);
        return true;
      } catch (error: any) {
        this.logger.error(`[Email/Resend] Échec envoi à ${to}: ${error.message}`);
      }
    }

    this.logger.log(`[Email Dev] À: ${to} | Sujet: ${subject}`);
    this.logger.log(`[Email Dev] Contenu: ${html.replace(/<[^>]*>/g, '').slice(0, 200)}`);
    return false;
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
          <h1 style="margin: 0; font-size: 24px;">Bienvenue sur FasoFree !</h1>
        </div>
        <div style="background: #FAF6F1; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Bonjour <strong>${userName}</strong>,</p>
          <p>Félicitations ! Votre candidature de <strong>${roleLabel}</strong> a été <strong style="color: #5C6B3C;">approuvée</strong>.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #E8E0D8;">
            <p style="margin: 0 0 10px 0;"><strong>Email :</strong> ${email}</p>
            <p style="margin: 0;"><strong>Mot de passe temporaire :</strong> <code style="background: #f4f4f4; padding: 2px 6px; border-radius: 4px; color: #C1652E; font-weight: bold;">${tempPassword}</code></p>
          </div>
          <p>Connectez-vous dès maintenant et modifiez votre mot de passe depuis votre profil.</p>
          <a href="https://fasofree-admin.onrender.com" style="display: inline-block; background: #C1652E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Se connecter</a>
        </div>
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">© FasoFree — Marketplace & Livraison, Ouagadougou</p>
      </div>
    `;
    this.logger.log(`[Email] Envoi e-mail d'approbation ${roleLabel} à ${email}`);
    const sent = await this.sendEmail(email, `FasoFree — Votre compte ${roleLabel} est approuvé !`, html);
    if (sent) {
      this.logger.log(`[Email] E-mail d'approbation ${roleLabel} envoyé avec succès à ${email}`);
    } else {
      this.logger.error(`[Email] Échec envoi e-mail d'approbation ${roleLabel} à ${email}`);
    }
    return sent;
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
          <a href="https://fasofree-admin.onrender.com" style="display: inline-block; background: #C1652E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Soumettre une nouvelle candidature</a>
        </div>
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">© FasoFree — Marketplace & Livraison, Ouagadougou</p>
      </div>
    `;
    this.logger.log(`[Email] Envoi e-mail de rejet ${roleLabel} à ${email}`);
    const sent = await this.sendEmail(email, `FasoFree — Votre candidature ${roleLabel} a été refusée`, html);
    if (sent) {
      this.logger.log(`[Email] E-mail de rejet ${roleLabel} envoyé avec succès à ${email}`);
    } else {
      this.logger.error(`[Email] Échec envoi e-mail de rejet ${roleLabel} à ${email}`);
    }
    return sent;
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
    this.logger.log(`[Email] Envoi e-mail OTP à ${email}`);
    const sent = await this.sendEmail(email, 'FasoFree — Votre code de vérification', html);
    if (sent) {
      this.logger.log(`[Email] E-mail OTP envoyé avec succès à ${email}`);
    } else {
      this.logger.error(`[Email] Échec envoi e-mail OTP à ${email}`);
    }
    return sent;
  }

  async sendWelcomeMerchantEmail(
    email: string,
    userName: string,
    businessName: string,
    tempPassword: string,
    promoCode: string | null,
  ): Promise<boolean> {
    const promoSection = promoCode
      ? `
        <div style="background: #5C6B3C; color: white; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 6px 0; font-size: 14px;">Votre code promo de bienvenue</p>
          <p style="margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 4px;">${promoCode}</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.85;">-10% sur la première commande de vos clients</p>
        </div>
      `
      : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #C1652E; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Bienvenue sur FasoFree !</h1>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Votre commerce est maintenant en ligne</p>
        </div>
        <div style="background: #FAF6F1; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Bonjour <strong>${userName}</strong>,</p>
          <p>Félicitations ! Votre compte marchand <strong>${businessName}</strong> a été <strong style="color: #5C6B3C;">approuvé</strong>.</p>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #E8E0D8;">
            <p style="margin: 0 0 12px 0; font-weight: bold; color: #2D2A26;">Vos identifiants de connexion</p>
            <p style="margin: 0 0 8px 0;"><strong>Email :</strong> ${email}</p>
            <p style="margin: 0;"><strong>Mot de passe temporaire :</strong> <code style="background: #f4f4f4; padding: 2px 8px; border-radius: 4px; color: #C1652E; font-weight: bold;">${tempPassword}</code></p>
          </div>

          <p style="color: #70645C; font-size: 14px;">Connectez-vous et changez immédiatement votre mot de passe depuis votre profil.</p>

          ${promoSection}

          <div style="text-align: center; margin: 24px 0;">
            <a href="https://fasofree-admin.onrender.com" style="display: inline-block; background: #C1652E; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">Se connecter</a>
          </div>

          <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #E8E0D8; margin-top: 16px;">
            <p style="margin: 0 0 8px 0; font-weight: bold; color: #2D2A26; font-size: 14px;">Prochaines étapes</p>
            <ul style="margin: 0; padding-left: 20px; color: #70645C; font-size: 13px; line-height: 1.8;">
              <li>Connectez-vous et changez votre mot de passe</li>
              <li>Ajoutez vos produits / menus</li>
              <li>Configurez vos horaires et options de livraison</li>
              <li>Partagez votre code promo avec vos premiers clients</li>
            </ul>
          </div>
        </div>
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">© FasoFree — Marketplace & Livraison, Ouagadougou</p>
      </div>
    `;
    this.logger.log(`[Email] Envoi e-mail bienvenue marchand à ${email} (promo: ${promoCode || 'aucun'})`);
    const sent = await this.sendEmail(email, `FasoFree — Bienvenue ${businessName} !`, html);
    if (sent) {
      this.logger.log(`[Email] E-mail bienvenue marchand envoyé avec succès à ${email}`);
    } else {
      this.logger.error(`[Email] Échec envoi e-mail bienvenue marchand à ${email}`);
    }
    return sent;
  }
}
