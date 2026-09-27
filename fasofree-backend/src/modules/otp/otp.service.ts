import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { EmailService } from '../notifications/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as crypto from 'crypto';

/**
 * 🔐 Gestion des codes OTP.
 *
 * Le flux classique (sendOtp/verifyOtp) vérifie le compte par email/téléphone
 * et marque `isEmailVerified`/`isPhoneVerified`. La SIGNATURE DE CONTRAT
 * réutilise le même canal (email/SMS) mais pour un but différent : valider
 * l'acceptation d'un contrat marchand/livreur. Elle utilise donc des méthodes
 * dédiées (`sendContractOtp`/`verifyContractOtp`) avec une CLÉ STORE SÉPARÉE
 * (`otp:{userId}:contract-sign`) : un code envoyé pour la signature ne peut
 * pas servir à vérifier le compte et inversement, et la vérification de
 * signature ne touche JAMAIS aux flags de vérification email/téléphone.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  private static readonly OTP_PREFIX = 'otp:';
  private static readonly OTP_EXPIRY_SECONDS = 300;
  private static readonly RESEND_COOLDOWN_SECONDS = 60;
  private static readonly MAX_VERIFY_ATTEMPTS = 5;

  // Purpose vide = vérification classique de compte (compatibilité totale
  // avec les clés d'avant : `otp:{userId}`).
  private static readonly PURPOSE_VERIFY = '';
  private static readonly PURPOSE_CONTRACT_SIGN = 'contract-sign';

  // Stockage en mémoire { hash sha256 du code, expiration, tentatives, dernier envoi }.
  // Le code en clair n'y figure JAMAIS : la comparaison se fait sur les hash
  // (timing-safe), et les tentatives échouées bloquent le brute-force par compte.
  private store = new Map<
    string,
    {
      codeHash: Buffer;
      expiresAt: number;
      attempts: number;
      lastSentAt: number;
    }
  >();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendOtp(userId: string): Promise<{ message: string; expiresIn: number }> {
    return this.sendOtpForPurpose(userId, OtpService.PURPOSE_VERIFY);
  }

  async verifyOtp(userId: string, code: string): Promise<{ message: string; verified: boolean }> {
    return this.verifyOtpForPurpose(
      userId,
      code,
      OtpService.PURPOSE_VERIFY,
      true,
      'Compte vérifié avec succès',
    );
  }

  /**
   * ✍️ Signature de contrat : envoie un code OTP pour valider l'acceptation
   * d'un contrat (marchand/livreur). Clé de stockage distincte de la
   * vérification de compte ; les flags email/téléphone ne sont PAS touchés.
   */
  async sendContractOtp(userId: string): Promise<{ message: string; expiresIn: number }> {
    return this.sendOtpForPurpose(userId, OtpService.PURPOSE_CONTRACT_SIGN);
  }

  /**
   * ✍️ Vérifie le code OTP de signature de contrat (sans marquer le compte
   * comme vérifié — seul `verified: true` est renvoyé au LegalService qui
   * enregistre l'acceptation).
   */
  async verifyContractOtp(
    userId: string,
    code: string,
  ): Promise<{ message: string; verified: boolean }> {
    return this.verifyOtpForPurpose(
      userId,
      code,
      OtpService.PURPOSE_CONTRACT_SIGN,
      false,
      'Contrat signé avec succès',
    );
  }

  async isVerified(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return false;
    return user.isEmailVerified && user.isPhoneVerified;
  }

  // ─── Implémentation commune (purpose = clé de stockage distincte) ────────

  private async sendOtpForPurpose(
    userId: string,
    purpose: string,
  ): Promise<{ message: string; expiresIn: number }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    const code = this.generateCode();
    const key = OtpService.otpKey(userId, purpose);
    const expiresAt = Date.now() + OtpService.OTP_EXPIRY_SECONDS * 1000;
    const now = Date.now();

    // ⏳ Cooldown : empêche le spam d'envois (chaque envoi écrase le code
    // en cours et inonder la boîte mail de l'utilisateur coûte de l'argent).
    const existing = this.store.get(key);
    if (existing && now - existing.lastSentAt < OtpService.RESEND_COOLDOWN_SECONDS * 1000) {
      const wait = Math.ceil(
        (OtpService.RESEND_COOLDOWN_SECONDS * 1000 - (now - existing.lastSentAt)) / 1000,
      );
      throw new BadRequestException(
        `Veuillez patienter ${wait} seconde(s) avant de redemander un code.`,
      );
    }

    this.store.set(key, {
      codeHash: crypto.createHash('sha256').update(code).digest(),
      expiresAt,
      attempts: 0,
      lastSentAt: now,
    });

    // 🔐 Jamais de code OTP en clair dans les logs en production.
    // En dev uniquement, on affiche le code pour faciliter les tests locaux.
    const isProd = process.env.NODE_ENV === 'production';
    const masked = `${code.slice(0, 2)}••••${code.slice(-2)}`;
    const label = purpose === OtpService.PURPOSE_CONTRACT_SIGN ? 'signature contrat' : 'vérification';
    this.logger.log(
      `[OTP] Code ${isProd ? masked : code} généré pour ${user.email} (${label}, exp: ${OtpService.OTP_EXPIRY_SECONDS}s)`,
    );
    if (!isProd) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`  ⚠️  CODE OTP POUR ${user.email} (${label}) : ${code}`);
      console.log(`  ⏱️  Expire dans ${OtpService.OTP_EXPIRY_SECONDS / 60} minute(s)`);
      console.log(`${'='.repeat(60)}\n`);
    }

    // Priorité 1 : email Resend via sendOtpEmail (HTML bannierte)
    let sent = false;
    if (user.email) {
      try {
        sent = await this.emailService.sendOtpEmail(user.email, user.fullName, code);
      } catch (err) {
        this.logger.warn(`[OTP] Échec envoi email Resend: ${(err as Error).message}`);
      }
    }

    // Fallback : notifications multi-canal (SMS, WhatsApp, Push, etc.)
    if (!sent) {
      const isContractSign = purpose === OtpService.PURPOSE_CONTRACT_SIGN;
      const subject = isContractSign
        ? 'FasoFree — Signature de votre contrat'
        : 'FasoFree — Code de vérification';
      // Message du flux de vérification STRICTEMENT inchangé (compatibilité) ;
      // seul le libellé du flux contrat est spécifique.
      const message = `Votre code ${
        isContractSign ? 'de signature de contrat' : 'de vérification'
      } FasoFree est : ${code}\n\nCe code expire dans 5 minutes.\n\nSi vous n'avez pas demandé ce code, ignorez ce message.`;
      try {
        await this.notificationsService.sendNotification(user, subject, message);
      } catch (err) {
        this.logger.warn(`[OTP] Échec envoi notification fallback: ${(err as Error).message}`);
      }
    }

    return {
      message: purpose === OtpService.PURPOSE_CONTRACT_SIGN
        ? 'Code de signature envoyé'
        : 'Code de vérification envoyé',
      expiresIn: OtpService.OTP_EXPIRY_SECONDS,
    };
  }

  private async verifyOtpForPurpose(
    userId: string,
    code: string,
    purpose: string,
    markVerified: boolean,
    successMessage: string,
  ): Promise<{ message: string; verified: boolean }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    const key = OtpService.otpKey(userId, purpose);
    const stored = this.store.get(key);

    if (!stored || Date.now() > stored.expiresAt) {
      if (stored) this.store.delete(key);
      throw new BadRequestException('Code OTP expiré ou introuvable. Demandez un nouveau code.');
    }

    // 🔒 Brute-force : 5 essais max par code, puis invalidation.
    if (stored.attempts >= OtpService.MAX_VERIFY_ATTEMPTS) {
      this.store.delete(key);
      throw new UnauthorizedException('Trop de tentatives. Demandez un nouveau code.');
    }

    // Comparaison timing-safe sur les hash sha256 (jamais le code en clair).
    const providedHash = crypto.createHash('sha256').update(code.trim()).digest();
    if (!crypto.timingSafeEqual(providedHash, stored.codeHash)) {
      stored.attempts += 1;
      this.store.set(key, stored);
      const remaining = OtpService.MAX_VERIFY_ATTEMPTS - stored.attempts;
      throw new UnauthorizedException(
        `Code OTP incorrect (${remaining} essai(s) restant(s))`,
      );
    }

    this.store.delete(key);

    // La vérification de signature de contrat ne doit PAS marquer le compte
    // comme vérifié (flags email/téléphone) : seuls sendOtp/verifyOtp le font.
    if (markVerified) {
      await this.userRepository.update(userId, {
        isEmailVerified: true,
        isPhoneVerified: true,
      });
    }

    this.logger.log(`[OTP] Code ${purpose ? `(${purpose}) ` : ''}validé pour ${user.email}`);

    return {
      message: successMessage,
      verified: true,
    };
  }

  private static otpKey(userId: string, purpose: string): string {
    // Purpose vide → clé historique `otp:{userId}` (compatibilité).
    return OtpService.OTP_PREFIX + userId + (purpose ? `:${purpose}` : '');
  }

  private generateCode(): string {
    // 6 chiffres sur toute la plage (max exclu) : 100000 → 999999.
    return crypto.randomInt(100000, 1000000).toString();
  }
}
