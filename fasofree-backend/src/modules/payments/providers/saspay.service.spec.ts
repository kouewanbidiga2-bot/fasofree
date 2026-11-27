/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';
import { SasPayService } from './saspay.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const SECRET = 'test-webhook-secret';

const config = (values: Record<string, string>) =>
  ({ get: (key: string, def?: string) => values[key] ?? def }) as unknown as ConfigService;

const sign = (timestamp: string, body: string, secret = SECRET) =>
  crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

describe('SasPayService', () => {
  const service = new SasPayService(
    config({
      SASPAY_API_KEY: 'sk_test_123',
      SASPAY_COUNTRY: 'BF',
      SASPAY_WEBHOOK_SECRET: SECRET,
    }),
  );

  beforeEach(() => jest.clearAllMocks());

  describe('verifyWebhookSignature', () => {
    it('accepte une signature HMAC-SHA256 du timestamp.corps', () => {
      const body = '{"event":"transaction.success"}';
      const ts = String(Math.floor(Date.now() / 1000));
      expect(service.verifyWebhookSignature(body, sign(ts, body), ts, SECRET)).toBe(true);
    });

    it('rejette une signature calculée sur un autre corps', () => {
      const body = '{"event":"transaction.success"}';
      const ts = String(Math.floor(Date.now() / 1000));
      expect(service.verifyWebhookSignature(body, sign(ts, '{"event":"autre"}'), ts, SECRET)).toBe(false);
    });

    it('rejette une signature produite avec un autre secret', () => {
      const body = '{"event":"transaction.success"}';
      const ts = String(Math.floor(Date.now() / 1000));
      expect(service.verifyWebhookSignature(body, sign(ts, body, 'autre-secret'), ts, SECRET)).toBe(false);
    });

    it('rejette une signature absente ou un secret absent (fail-closed)', () => {
      const body = '{"event":"transaction.success"}';
      const ts = String(Math.floor(Date.now() / 1000));
      expect(service.verifyWebhookSignature(body, '', ts, SECRET)).toBe(false);
      expect(service.verifyWebhookSignature(body, sign(ts, body), ts, '')).toBe(false);
    });

    it('rejette un timestamp hors tolérance (5 min)', () => {
      const body = '{"event":"transaction.success"}';
      const oldTs = String(Math.floor(Date.now() / 1000) - 600);
      expect(service.verifyWebhookSignature(body, sign(oldTs, body), oldTs, SECRET)).toBe(false);
    });
  });

  describe('createPayment', () => {
    it('envoie le contrat de la doc et renvoie checkoutUrl', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            id: 'pay-1',
            status: 'PENDING',
            // SasPay renvoie l'URL sans schéma sur certains réseaux.
            checkout_url: 'pay.saspay.me/checkout/pay-1',
          },
          code: 201,
        },
      });

      const result = await service.createPayment({
        amount: 2500,
        currency: 'XOF',
        country: 'BF',
        customer: {
          email: 'client@fasofree.bf',
          firstName: 'Awa',
          lastName: 'Sossou',
          phone: '+22670000000',
        },
        network: 'orange_bf',
        description: 'Commande #123',
        idempotencyKey: 'ref-1',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.saspay.me/api/v1/payments/softpay/',
        expect.objectContaining({
          amount: '2500.00',
          currency: 'XOF',
          country: 'BF',
          network: 'orange_bf',
        }),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer sk_test_123' }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'pay-1',
          status: 'PENDING',
          checkoutUrl: 'https://pay.saspay.me/checkout/pay-1',
        }),
      );
    });
  });

  describe('createCheckoutSession', () => {
    it('déballe l’enveloppe SasPay et renvoie une URL absolue', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            id: 'cs-1',
            slug: 'kZ2v9rT4bQxL8mNpYw==',
            checkout_url: 'pay.saspay.me/checkout/kZ2v9rT4bQxL8mNpYw==',
            status: 'PENDING',
          },
          code: 201,
        },
      });

      const result = await service.createCheckoutSession({
        amount: 900,
        customerEmail: 'client@koliwa.test',
        customerName: 'Awa Verification',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.saspay.me/api/v1/checkout-sessions/',
        expect.objectContaining({
          amount: '900.00',
          currency: 'XOF',
          country: 'BF',
          customer_email: 'client@koliwa.test',
          customer_name: 'Awa Verification',
        }),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer sk_test_123' }),
        }),
      );
      expect(result).toEqual({
        id: 'cs-1',
        checkoutUrl: 'https://pay.saspay.me/checkout/kZ2v9rT4bQxL8mNpYw==',
      });
    });
  });
});
