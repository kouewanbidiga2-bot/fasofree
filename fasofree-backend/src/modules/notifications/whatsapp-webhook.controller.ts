import { createHmac, timingSafeEqual } from 'crypto';
import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  Logger,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { WhatsAppService } from './whatsapp.service';

const ORDER_STATUS_MAP: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmee',
  PREPARING: 'En preparation',
  READY: 'Pret',
  OUT_FOR_DELIVERY: 'En cours de livraison',
  DELIVERED: 'Livree',
  CANCELLED: 'Annulee',
};

@ApiTags('Webhooks')
@Controller('webhooks')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);
  private readonly verifyToken: string | undefined;
  private readonly appSecret: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly whatsappService: WhatsAppService,
  ) {
    // 🛡️ AUCUN secret codé en dur : si WHATSAPP_VERIFY_TOKEN n'est pas
    // configuré, la vérification échoue systématiquement (fail-closed).
    this.verifyToken = this.configService.get<string>(
      'WHATSAPP_VERIFY_TOKEN',
    );
    this.appSecret = this.configService.get<string>('WHATSAPP_APP_SECRET');
  }

  private verifyMetaSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.appSecret) {
      this.logger.warn(
        '[WhatsApp Webhook] WHATSAPP_APP_SECRET non configuré — événement rejeté',
      );
      return false;
    }
    if (!signature?.startsWith('sha256=')) return false;
    const computed = createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex');
    const expected = Buffer.from(computed, 'hex');
    const received = Buffer.from(signature.slice('sha256='.length), 'hex');
    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  }

  @Get('whatsapp')
  @ApiOperation({ summary: 'WhatsApp webhook verification (Meta)' })
  handleVerification(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    this.logger.log(`[WhatsApp Webhook] Verification request: mode=${mode}, token=${token}`);

    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('[WhatsApp Webhook] Verification successful');
      return challenge;
    }

    this.logger.warn('[WhatsApp Webhook] Verification failed -- invalid token');
    return 'Verification failed';
  }

  @Post('whatsapp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WhatsApp webhook events (Meta)' })
  handleEvents(
    @Body() payload: any,
    @Req() req: Request,
  ): { status: string } {
    // 🛡️ Vérification d'authenticité Meta (HMAC-SHA256 du corps brut).
    // Sans signature valide, l'événement est rejeté (fail-closed).
    const signature = req.header('x-hub-signature-256') || '';
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!this.verifyMetaSignature(rawBody || Buffer.alloc(0), signature)) {
      throw new UnauthorizedException('Invalid X-Hub-Signature-256');
    }

    this.logger.debug(`[WhatsApp Webhook] Event received: ${JSON.stringify(payload).slice(0, 500)}`);

    try {
      const entries = payload?.entry || [];
      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          if (change.field === 'messages') {
            this.processMessageChange(change.value);
          }
        }
      }
    } catch (err) {
      this.logger.error(`[WhatsApp Webhook] Processing error: ${(err as Error).message}`);
    }

    return { status: 'ok' };
  }

  private processMessageChange(value: any): void {
    const messages = value?.messages || [];
    for (const msg of messages) {
      this.logger.log(
        `[WhatsApp Inbound] From: ${msg.from} | Type: ${msg.type} | Text: ${msg.text?.body || '(non-text)'}`,
      );

      if (msg.type === 'text') {
        this.handleTextMessage(msg.from, msg.text?.body || '');
      }
    }

    const statuses = value?.statuses || [];
    for (const status of statuses) {
      this.logger.log(
        `[WhatsApp Status] ID: ${status.id} | Status: ${status.status} | Timestamp: ${status.timestamp}`,
      );
    }
  }

  private async handleTextMessage(from: string, text: string): Promise<void> {
    const normalized = text.trim().toLowerCase();

    if (normalized === 'suivi' || normalized === 'suivre' || normalized === 'track') {
      await this.whatsappService.sendTextMessage(
        from,
        'Envoyez le numero de votre commande (ex: FF12345678) pour suivre sa livraison.',
      );
      return;
    }

    if (normalized === 'aide' || normalized === 'help' || normalized === 'menu') {
      await this.whatsappService.sendTextMessage(
        from,
        'Bienvenue sur FasoFree!\n\n' +
        'Commandes disponibles:\n' +
        '- SUIVI + numero de commande -> statut de livraison\n' +
        '- AIDE -> ce message\n' +
        '- STORIES -> decouvrir les stories des restaurants',
      );
      return;
    }

    if (normalized.startsWith('ff') && normalized.length >= 10) {
      const orderId = normalized.toUpperCase();
      await this.whatsappService.sendTextMessage(
        from,
        `Commande ${orderId}: en cours de verification.\n` +
        'Vous recevrez une notification des que le statut change.',
      );
      this.logger.log(`[WhatsApp] Order tracking request: ${orderId} from ${from}`);
      return;
    }

    if (normalized === 'stories') {
      await this.whatsappService.sendTextMessage(
        from,
        'Decouvrez les stories des restaurants sur FasoFree!\n' +
        'Ouvrez l\'application pour voir les dernieres creations.',
      );
      return;
    }

    await this.whatsappService.sendTextMessage(
      from,
      'Merci de nous avoir contactes!\n' +
      'Tapez AIDE pour voir les commandes disponibles.',
    );
  }
}
