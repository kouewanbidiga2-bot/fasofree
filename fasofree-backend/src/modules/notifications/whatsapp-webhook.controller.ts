import { Controller, Get, Post, Query, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);
  private readonly verifyToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly whatsappService: WhatsAppService,
  ) {
    this.verifyToken = this.configService.get<string>(
      'WHATSAPP_VERIFY_TOKEN',
      'fasofree_webhook_secret_2026',
    );
  }

  /**
   * 🔗 Meta Webhook Verification (GET)
   * Meta sends this to verify your webhook URL during setup.
   */
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

    this.logger.warn('[WhatsApp Webhook] Verification failed — invalid token');
    return 'Verification failed';
  }

  /**
   * 📩 WhatsApp Webhook Events (POST)
   * Receives incoming messages and status updates from Meta.
   */
  @Post('whatsapp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WhatsApp webhook events (Meta)' })
  handleEvents(@Body() payload: any): { status: string } {
    this.logger.debug(`[WhatsApp Webhook] Event received: ${JSON.stringify(payload).slice(0, 500)}`);

    try {
      // Meta sends an array of entries
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
    // Handle incoming messages
    const messages = value?.messages || [];
    for (const msg of messages) {
      this.logger.log(
        `[WhatsApp Inbound] From: ${msg.from} | Type: ${msg.type} | Text: ${msg.text?.body || '(non-text)'}`,
      );
      // TODO: process inbound messages (support chat, order tracking, etc.)
    }

    // Handle status updates
    const statuses = value?.statuses || [];
    for (const status of statuses) {
      this.logger.log(
        `[WhatsApp Status] ID: ${status.id} | Status: ${status.status} | Timestamp: ${status.timestamp}`,
      );
      // TODO: update order notification status in DB
    }
  }
}
