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
      'EMAIL_FROM',
      'FasoFree <noreply@fasofree.site>',
    );

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('[Email/Resend] Client initialisé');
    } else {
      this.resend = null;
      this.logger.warn('[Email/Resend] RESEND_API_KEY manquant - emails desactives');
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn('[Email/Resend] Envoi ignore (pas de cle API) -> ' + to);
      return false;
    }
    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: [to],
        subject,
        html,
      });
      if (result.error) {
        this.logger.error('[Email/Resend] Erreur API -> ' + to + ': ' + JSON.stringify(result.error));
        return false;
      }
      this.logger.log('[Email/Resend) Envoye a ' + to + ' - Sujet: ' + subject + ' (id: ' + (result.data?.id || '') + ')');
      return true;
    } catch (error: any) {
      this.logger.error('[Email/Resend] Echec envoi a ' + to + ': ' + error.message);
      return false;
    }
  }

  async sendApprovalEmail(email: string, userName: string, role: string, tempPassword: string): Promise<boolean> {
    const roleLabel = role === 'DRIVER' ? 'Livreur' : 'Marchand';
    const html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#C1652E;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0"><h1 style="margin:0;font-size:24px">Bienvenue sur FasoFree !</h1></div><div style="background:#FAF6F1;padding:30px;border-radius:0 0 8px 8px"><p>Bonjour <strong>' + userName + '</strong>,</p><p>Felicitations ! Votre candidature de <strong>' + roleLabel + '</strong> a ete <strong style="color:#5C6B3C">approuvee</strong>.</p><div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #E8E0D8"><p style="margin:0 0 10px 0"><strong>Email :</strong> ' + email + '</p><p style="margin:0"><strong>Mot de passe temporaire :</strong> <code style="background:#f4f4f4;padding:2px 6px;border-radius:4px;color:#C1652E;font-weight:bold">' + tempPassword + '</code></p></div><p>Connectez-vous des maintenant et modifiez votre mot de passe depuis votre profil.</p><a href="https://fasofree.site" style="display:inline-block;background:#C1652E;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:10px">Se connecter</a></div><p style="text-align:center;color:#999;font-size:12px;margin-top:20px">FasoFree - Marketplace & Livraison, Ouagadougou</p></div>';
    return this.sendEmail(email, 'FasoFree - Votre compte ' + roleLabel + ' est approuve !', html);
  }

  async sendRejectionEmail(email: string, userName: string, role: string, reason: string): Promise<boolean> {
    const roleLabel = role === 'DRIVER' ? 'Livreur' : 'Marchand';
    const html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#70645C;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0"><h1 style="margin:0;font-size:24px">FasoFree - Mise a jour de votre candidature</h1></div><div style="background:#FAF6F1;padding:30px;border-radius:0 0 8px 8px"><p>Bonjour <strong>' + userName + '</strong>,</p><p>Votre candidature de <strong>' + roleLabel + '</strong> a ete <strong style="color:#C44D56">refusee</strong>.</p><div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #E8E0D8"><p style="margin:0 0 10px 0"><strong>Motif du refus :</strong></p><p style="margin:0;color:#70645C">' + reason + '</p></div><p>Vous pouvez corriger les elements signales et soumettre une nouvelle candidature.</p></div><p style="text-align:center;color:#999;font-size:12px;margin-top:20px">FasoFree - Marketplace & Livraison, Ouagadougou</p></div>';
    return this.sendEmail(email, 'FasoFree - Votre candidature ' + roleLabel + ' a ete refusee', html);
  }

  async sendOtpEmail(email: string, userName: string, code: string): Promise<boolean> {
    const html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#C1652E;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0"><h1 style="margin:0;font-size:24px">Code de verification FasoFree</h1></div><div style="background:#FAF6F1;padding:30px;border-radius:0 0 8px 8px"><p>Bonjour <strong>' + userName + '</strong>,</p><p>Voici votre code de verification :</p><div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #E8E0D8;text-align:center"><p style="margin:0;font-size:32px;font-weight:bold;color:#C1652E;letter-spacing:8px">' + code + '</p></div><p style="color:#70645C;font-size:14px">Ce code expire dans <strong>5 minutes</strong>.</p><p style="color:#70645C;font-size:14px">Si vous navez pas demande ce code, ignorez cet email.</p></div><p style="text-align:center;color:#999;font-size:12px;margin-top:20px">FasoFree - Marketplace & Livraison, Ouagadougou</p></div>';
    return this.sendEmail(email, 'FasoFree - Votre code de verification', html);
  }

  async sendWelcomeMerchantEmail(email: string, userName: string, businessName: string, tempPassword: string, promoCode: string | null): Promise<boolean> {
    const promoSection = promoCode ? '<div style="background:#5C6B3C;color:white;padding:16px;border-radius:8px;margin:20px 0;text-align:center"><p style="margin:0 0 6px 0;font-size:14px">Votre code promo de bienvenue</p><p style="margin:0;font-size:28px;font-weight:bold;letter-spacing:4px">' + promoCode + '</p><p style="margin:8px 0 0 0;font-size:12px;opacity:0.85">-10% sur la premiere commande de vos clients</p></div>' : '';
    const html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#C1652E;color:white;padding:24px;text-align:center;border-radius:8px 8px 0 0"><h1 style="margin:0;font-size:24px">Bienvenue sur FasoFree !</h1><p style="margin:8px 0 0 0;font-size:14px;opacity:0.9">Votre commerce est maintenant en ligne</p></div><div style="background:#FAF6F1;padding:30px;border-radius:0 0 8px 8px"><p>Bonjour <strong>' + userName + '</strong>,</p><p>Felicitations ! Votre compte marchand <strong>' + businessName + '</strong> a ete <strong style="color:#5C6B3C">approuve</strong>.</p><div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #E8E0D8"><p style="margin:0 0 12px 0;font-weight:bold;color:#2D2A26">Vos identifiants de connexion</p><p style="margin:0 0 8px 0"><strong>Email :</strong> ' + email + '</p><p style="margin:0"><strong>Mot de passe temporaire :</strong> <code style="background:#f4f4f4;padding:2px 8px;border-radius:4px;color:#C1652E;font-weight:bold">' + tempPassword + '</code></p></div><p style="color:#70645C;font-size:14px">Connectez-vous et changez immediatement votre mot de passe depuis votre profil.</p>' + promoSection + '<div style="text-align:center;margin:24px 0"><a href="https://fasofree.site" style="display:inline-block;background:#C1652E;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold">Se connecter</a></div></div><p style="text-align:center;color:#999;font-size:12px;margin-top:20px">FasoFree - Marketplace & Livraison, Ouagadougou</p></div>';
    return this.sendEmail(email, 'FasoFree - Bienvenue ' + businessName + ' !', html);
  }
}
