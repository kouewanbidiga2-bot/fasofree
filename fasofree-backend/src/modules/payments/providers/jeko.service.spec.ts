/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';
import { JekoService } from './jeko.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const SECRET = 'test-webhook-secret';
const BODY = '{"id":"txn_1","status":"success"}';

const config = (values: Record<string, string>) =>
  ({ get: (key: string, def?: string) => values[key] ?? def }) as unknown as ConfigService;

const sign = (body: string, secret = SECRET) =>
  crypto.createHmac('sha256', secret).update(body).digest('hex');

describe('JekoService', () => {
  const service = new JekoService(
    config({
      JEKO_API_KEY: 'key',
      JEKO_API_KEY_ID: 'key-id',
      JEKO_STORE_ID: 'store-1',
      JEKO_WEBHOOK_SECRET: SECRET,
    }),
  );

  beforeEach(() => jest.clearAllMocks());

  describe('verifyWebhookSignature', () => {
    it('accepte une signature HMAC-SHA256 hexadécimale du corps brut', () => {
      expect(service.verifyWebhookSignature(BODY, sign(BODY), SECRET)).toBe(true);
    });

    it('rejette une signature calculée sur un autre corps', () => {
      expect(service.verifyWebhookSignature(BODY, sign('{"id":"autre"}'), SECRET)).toBe(false);
    });

    it('rejette une signature produite avec un autre secret', () => {
      expect(service.verifyWebhookSignature(BODY, sign(BODY, 'autre-secret'), SECRET)).toBe(false);
    });

    it('rejette une signature absente ou un secret absent (fail-closed)', () => {
      expect(service.verifyWebhookSignature(BODY, '', SECRET)).toBe(false);
      expect(service.verifyWebhookSignature(BODY, sign(BODY), '')).toBe(false);
    });
  });

  describe('createPaymentRequest', () => {
    it('envoie le contrat de la doc et renvoie redirectUrl', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          id: 'pr-1',
          status: 'pending',
          redirectUrl: 'https://pay.jeko.africa/pay_request/pr/pr-1',
        },
      });

      const result = await service.createPaymentRequest({
        amountCents: 500000,
        reference: 'FF-PAY-1',
        paymentMethod: 'orange_money',
        successUrl: 'https://fasofree.site/ok',
        errorUrl: 'https://fasofree.site/ko',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.jeko.africa/partner_api/payment_requests',
        {
          storeId: 'store-1',
          amountCents: 500000,
          currency: 'XOF',
          reference: 'FF-PAY-1',
          paymentDetails: {
            type: 'redirect',
            data: {
              paymentMethod: 'orange',
              successUrl: 'https://fasofree.site/ok',
              errorUrl: 'https://fasofree.site/ko',
            },
          },
        },
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-API-KEY': 'key', 'X-API-KEY-ID': 'key-id' }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'pr-1',
          status: 'pending',
          redirectUrl: 'https://pay.jeko.africa/pay_request/pr/pr-1',
        }),
      );
    });
  });
});
