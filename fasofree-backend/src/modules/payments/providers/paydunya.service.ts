/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export type PaydunyaWithdrawMode =
  | 'orange-money-burkina'
  | 'moov-burkina-faso'
  | 'wave-burkina'
  | 'paydunya';

export interface CreatePayinInvoiceInput {
  amountXof: number;
  description: string;
  customData: Record<string, any>;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface ExecutePayoutInput {
  phoneNumber: string;
  amountXof: number;
  withdrawMode: PaydunyaWithdrawMode;
  withdrawId: string;
}

@Injectable()
export class PaydunyaService {
  private readonly logger = new Logger(PaydunyaService.name);

  constructor(private readonly configService: ConfigService) {}

  private get mode(): string {
    return (this.configService.get<string>('PAYDUNYA_MODE') || 'live').toLowerCase();
  }

  private get masterKey(): string {
    return this.configService.get<string>('PAYDUNYA_MASTER_KEY') || '';
  }

  private get publicKey(): string {
    return this.configService.get<string>('PAYDUNYA_PUBLIC_KEY') || '';
  }

  private get privateKey(): string {
    return this.configService.get<string>('PAYDUNYA_PRIVATE_KEY') || '';
  }

  private get token(): string {
    return this.configService.get<string>('PAYDUNYA_TOKEN') || '';
  }

  private get frontendUrl(): string {
    return this.configService.get<string>('CLIENT_URL') || 'https://fasofree.site';
  }

  private get backendUrl(): string {
    return this.configService.get<string>('BACKEND_URL') || 'https://fasofree-3nh8.onrender.com';
  }

  /**
   * Vérifie si PayDunya est configuré (4 clés requises)
   */
  isConfigured(): boolean {
    return Boolean(this.masterKey && this.publicKey && this.privateKey && this.token);
  }

  /**
   * Headers d'authentification PayDunya
   */
  private getHeaders(): Record<string, string> {
    if (!this.isConfigured()) {
      throw new BadRequestException('PayDunya non configuré sur le serveur.');
    }
    return {
      'Content-Type': 'application/json',
      'PAYDUNYA-MASTER-KEY': this.masterKey,
      'PAYDUNYA-PUBLIC-KEY': this.publicKey,
      'PAYDUNYA-PRIVATE-KEY': this.privateKey,
      'PAYDUNYA-TOKEN': this.token,
    };
  }

  /**
   * URL de base v1 (Payin / Checkout) — sandbox ou live
   */
  private getBaseUrlV1(): string {
    return this.mode === 'live'
      ? 'https://app.paydunya.com/api/v1'
      : 'https://app.paydunya.com/sandbox-api/v1';
  }

  /**
   * 1. PAYIN : Créer une facture Checkout (Redirection client Mobile Money / Carte)
   */
  async createCheckoutInvoice(input: CreatePayinInvoiceInput): Promise<{
    token: string;
    checkoutUrl: string;
  }> {
    const amount = Math.round(input.amountXof);
    if (amount <= 0) {
      throw new BadRequestException('Le montant PayDunya doit être supérieur à 0 FCFA.');
    }

    const payload = {
      invoice: {
        total_amount: amount,
        description: input.description,
      },
      store: {
        name: 'FasoFree',
        website_url: this.frontendUrl,
      },
      custom_data: input.customData,
      actions: {
        callback_url: `${this.backendUrl}/api/v1/paydunya/webhook`,
        return_url: input.returnUrl || `${this.frontendUrl}/payment/success`,
        cancel_url: input.cancelUrl || `${this.frontendUrl}/payment/cancel`,
      },
    };

    const res = await fetch(`${this.getBaseUrlV1()}/checkout-invoice/create`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const data: any = await res.json();

    if (data.response_code !== '00' || !data.token || !data.response_text) {
      this.logger.error(`Erreur création facture PayDunya: ${JSON.stringify(data)}`);
      throw new BadRequestException(
        data.response_text || 'Impossible de créer la facture de paiement PayDunya.',
      );
    }

    return {
      token: data.token,
      checkoutUrl: data.response_text,
    };
  }

  /**
   * 2. VÉRIFICATION D'ÉTAT (Double check ou fallback si l'IPN tarde)
   */
  async confirmInvoiceStatus(invoiceToken: string): Promise<any> {
    const res = await fetch(
      `${this.getBaseUrlV1()}/checkout-invoice/confirm/${encodeURIComponent(invoiceToken)}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      },
    );
    return res.json();
  }

  /**
   * 3. SÉCURITÉ WEBHOOK IPN : Vérifie que le hash SHA-512 correspond à notre Master Key
   */
  verifyIpnSignature(receivedHash?: string): void {
    if (!receivedHash || !this.masterKey) {
      throw new UnauthorizedException('Signature IPN PayDunya manquante.');
    }

    const expectedHash = crypto
      .createHash('sha512')
      .update(this.masterKey)
      .digest('hex');

    if (receivedHash.toLowerCase() !== expectedHash.toLowerCase()) {
      this.logger.warn('Tentative de webhook IPN PayDunya avec un hash invalide !');
      throw new UnauthorizedException('Signature IPN PayDunya invalide.');
    }
  }

  /**
   * 4. PAYOUT (PER / Déboursement Mobile Money en 2 étapes : get-invoice -> submit-invoice)
   * Note: L'API v2 Disburse utilise TOUJOURS l'URL live, même en mode test.
   */
  async executePayout(input: ExecutePayoutInput): Promise<{
    disburseToken: string;
    transactionId?: string;
    providerRef?: string;
    rawResponse: any;
  }> {
    const amount = Math.round(input.amountXof);
    if (amount < 100) {
      throw new BadRequestException('Le montant minimum de décaissement est de 100 FCFA.');
    }

    // Nettoyage du numéro : PayDunya attend le numéro local sans +226 ni 00226
    const cleanPhone = input.phoneNumber
      .replace(/\s+/g, '')
      .replace(/^(\+226|00226)/, '');

    // Étape A : Créer le token de déboursement (get-invoice) — URL v2 LIVE
    const getInvoiceRes = await fetch('https://app.paydunya.com/api/v2/disburse/get-invoice', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        account_alias: cleanPhone,
        amount: amount,
        withdraw_mode: input.withdrawMode,
        callback_url: `${this.backendUrl}/api/v1/paydunya/disburse-webhook`,
      }),
    });

    const getInvoiceData: any = await getInvoiceRes.json();

    if (getInvoiceData.response_code !== '00' || !getInvoiceData.disburse_token) {
      this.logger.error(`Échec PayDunya get-invoice: ${JSON.stringify(getInvoiceData)}`);
      throw new BadRequestException(
        getInvoiceData.response_text || 'Erreur lors de la préparation du transfert Mobile Money.',
      );
    }

    const disburseToken = getInvoiceData.disburse_token;

    // Étape B : Exécuter le transfert (submit-invoice)
    const submitRes = await fetch('https://app.paydunya.com/api/v2/disburse/submit-invoice', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        disburse_invoice: disburseToken,
        disburse_id: input.withdrawId,
      }),
    });

    const submitData: any = await submitRes.json();

    if (submitData.response_code !== '00') {
      this.logger.error(`Échec PayDunya submit-invoice: ${JSON.stringify(submitData)}`);
      throw new BadRequestException(
        submitData.response_text || 'Le transfert Mobile Money a été rejeté par PayDunya.',
      );
    }

    return {
      disburseToken,
      transactionId: submitData.transaction_id,
      providerRef: submitData.provider_ref,
      rawResponse: submitData,
    };
  }
}