/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Body, Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { GuestDeliveryDto } from './dto/guest-delivery.dto';
import { ClientValidateDeliveryDto } from './dto/validate-delivery.dto';

/**
 * Suivi public destiné au receveur qui n'a pas de compte Koliwa.
 * La référence donne accès à la carte, le lien signé au parcours de remise.
 */
@ApiTags('Public tracking')
@Controller('public-tracking')
export class PublicTrackingController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('guest-delivery')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @ApiOperation({ summary: 'Préparer et payer une livraison de colis sans compte' })
  createGuestDelivery(@Body() dto: GuestDeliveryDto) {
    return this.ordersService.createGuestDelivery(dto);
  }

  @Post('lookup')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Consulter la carte d’une livraison active par référence' })
  lookup(@Body('reference') reference: unknown) {
    return this.ordersService.getActiveTrackingByReference(reference);
  }

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Consulter le suivi partagé d’une livraison sans compte',
  })
  @ApiResponse({ status: 200, description: 'Suivi public de la livraison' })
  @ApiResponse({ status: 404, description: 'Lien invalide ou expiré' })
  getTracking(@Param('token') token: string) {
    return this.ordersService.getPublicTracking(token);
  }

  @Post(':token/receipt-code')
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  resendReceiptCode(@Param('token') token: string) {
    return this.ordersService.resendPublicDeliveryPin(token);
  }

  @Post(':token/confirm')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Le receveur confirme une livraison avec son PIN' })
  @ApiResponse({ status: 200, description: 'Réception confirmée' })
  @ApiResponse({ status: 400, description: 'PIN invalide ou statut incompatible' })
  confirmTracking(
    @Param('token') token: string,
    @Body() dto: ClientValidateDeliveryDto,
  ) {
    return this.ordersService.confirmPublicTracking(token, dto.pinCode);
  }
}
