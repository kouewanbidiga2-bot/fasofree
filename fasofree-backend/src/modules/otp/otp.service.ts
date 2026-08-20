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

  private store = new Map<string, { code: string; expiresAt: number }>();

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

    this.store.set(key, { code, expiresAt });
    this.logger.log(`[OTP] Code ${code} généré pour ${user.email} (exp: ${OtpService.OTP_EXPIRY_SECONDS}s)`);

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

    if (!stored) {
      throw new BadRequestException('Code OTP expiré ou introuvable. Demandez un nouveau code.');
    }

    if (Date.now() > stored.expiresAt) {
      this.store.delete(key);
      throw new BadRequestException('Code OTP expiré. Demandez un nouveau code.');
    }

    if (stored.code !== code.trim()) {
      throw new UnauthorizedException('Code OTP incorrect');
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
    return crypto.randomInt(100000, 999999).toString();
  }
}
