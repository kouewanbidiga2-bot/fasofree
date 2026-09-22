import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { EmailService } from '../notifications/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  private static readonly OTP_PREFIX = 'otp:';
  private static readonly OTP_EXPIRY_SECONDS = 300;
  private static readonly RESEND_COOLDOWN_SECONDS = 60;
  private static readonly MAX_VERIFY_ATTEMPTS = 5;

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
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    const code = this.generateCode();
    const key = OtpService.OTP_PREFIX + userId;
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
    this.logger.log(
      `[OTP] Code ${isProd ? masked : code} généré pour ${user.email} (exp: ${OtpService.OTP_EXPIRY_SECONDS}s)`,
    );
    if (!isProd) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`  ⚠️  CODE OTP POUR ${user.email} : ${code}`);
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
      const subject = 'FasoFree — Code de vérification';
      const message = `Votre code de vérification FasoFree est : ${code}\n\nCe code expire dans 5 minutes.\n\nSi vous n'avez pas demandé ce code, ignorez ce message.`;
      try {
        await this.notificationsService.sendNotification(user, subject, message);
      } catch (err) {
        this.logger.warn(`[OTP] Échec envoi notification fallback: ${(err as Error).message}`);
      }
    }

    return {
      message: 'Code de vérification envoyé',
      expiresIn: OtpService.OTP_EXPIRY_SECONDS,
    };
  }

  async verifyOtp(userId: string, code: string): Promise<{ message: string; verified: boolean }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    const key = OtpService.OTP_PREFIX + userId;
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

    await this.userRepository.update(userId, {
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    this.logger.log(`[OTP] Utilisateur ${user.email} vérifié avec succès`);

    return {
      message: 'Compte vérifié avec succès',
      verified: true,
    };
  }

  async isVerified(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return false;
    return user.isEmailVerified && user.isPhoneVerified;
  }

  private generateCode(): string {
    // 6 chiffres sur toute la plage (max exclu) : 100000 → 999999.
    return crypto.randomInt(100000, 1000000).toString();
  }
}
