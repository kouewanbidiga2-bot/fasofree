import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WaveWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signatureHeader = request.headers['wave-signature'];
    const rawBody = request.rawBody;

    if (!signatureHeader || !rawBody) {
      throw new BadRequestException(
        'Signature ou corps brut de requête introuvable',
      );
    }

    // Fail-closed : refuser la requête si le secret n'est pas configuré
    // (ne jamais signer avec une clé vide — HMAC("") accepte tout).
    const webhookSecret = this.configService.get<string>('WAVE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new UnauthorizedException(
        'Webhook Wave non configuré (WAVE_WEBHOOK_SECRET manquant)',
      );
    }

    try {
      // Le header Wave ressemble à : "t=1620000000,v1=5257a869e7ee..."
      const parts = signatureHeader.split(',');
      const timestamp = parts.find((p) => p.startsWith('t='))?.split('=')[1];
      const signature = parts.find((p) => p.startsWith('v1='))?.split('=')[1];

      if (!timestamp || !signature) {
        throw new UnauthorizedException('Format de signature Wave invalide');
      }

      // Fraîcheur : refuse les rejeux d'un webhook signé (fenêtre 5 min).
      const tsSeconds = Number(timestamp);
      if (
        !Number.isFinite(tsSeconds) ||
        Math.abs(Date.now() / 1000 - tsSeconds) > 300
      ) {
        throw new UnauthorizedException(
          'Signature Wave expirée ou timestamp invalide',
        );
      }

      // Reconstitution du message à signer : timestamp.rawBody
      const payloadToSign = `${timestamp}.${rawBody.toString()}`;
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadToSign)
        .digest('hex');

      // Comparaison sécurisée contre les attaques de timing
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );

      if (!isValid) {
        throw new UnauthorizedException('Signature Webhook Wave incorrecte');
      }

      return true;
    } catch (error) {
      throw new UnauthorizedException('Échec de la validation de la signature');
    }
  }
}
