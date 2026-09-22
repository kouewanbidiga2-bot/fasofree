import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { PdfImportService } from './pdf-import.service';

function mockGeminiResponse(text: string, ok = true, status = 200) {
  const mockFetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
    }),
    text: async () => text,
  });
  global.fetch = mockFetch as any;
  return mockFetch;
}

function mockGeminiWithFinishReason(reason: string) {
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      candidates: [{ finishReason: reason }],
    }),
  });
  global.fetch = mockFetch as any;
  return mockFetch;
}

describe('PdfImportService', () => {
  let service: PdfImportService;
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    configService = { get: jest.fn().mockReturnValue('test-key') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfImportService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<PdfImportService>(PdfImportService);
  });

  describe('isAvailable', () => {
    it('should return true when GEMINI_API_KEY is set', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('should return false when GEMINI_API_KEY is missing', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PdfImportService,
          { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
        ],
      }).compile();

      const noKeyService = module.get<PdfImportService>(PdfImportService);
      expect(noKeyService.isAvailable()).toBe(false);
    });
  });

  describe('analyzeMenuPdf', () => {
    it('should throw if API key is not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PdfImportService,
          { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
        ],
      }).compile();

      const noKeyService = module.get<PdfImportService>(PdfImportService);
      await expect(
        noKeyService.analyzeMenuPdf(Buffer.from('fake-pdf'), 'test.pdf'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid numeric prices', async () => {
      const response = JSON.stringify({
        businessName: 'Test',
        categories: [{
          name: 'Plats',
          products: [
            { name: 'Tiep', price: 1500, description: '' },
            { name: 'Poisson', price: 2000, description: '' },
          ],
        }],
      });
      mockGeminiResponse(response);

      const result = await service.analyzeMenuPdf(Buffer.from('fake'), 'test.pdf');

      expect(result.businessName).toBe('Test');
      expect(result.totalProducts).toBe(2);
      expect(result.categories[0].products[0].price).toBe(1500);
    });

    it('should accept string prices with F suffix', async () => {
      const response = JSON.stringify({
        businessName: 'Test',
        categories: [{
          name: 'Plats',
          products: [{ name: 'Tiep', price: '1500F', description: '' }],
        }],
      });
      mockGeminiResponse(response);

      const result = await service.analyzeMenuPdf(Buffer.from('fake'), 'test.pdf');
      expect(result.categories[0].products[0].price).toBe(1500);
    });

    it('should default to price 0 for invalid prices', async () => {
      const response = JSON.stringify({
        businessName: 'Test',
        categories: [{
          name: 'Plats',
          products: [{ name: 'Tiep', price: 'invalid', description: '' }],
        }],
      });
      mockGeminiResponse(response);

      const result = await service.analyzeMenuPdf(Buffer.from('fake'), 'test.pdf');
      expect(result.categories[0].products[0].price).toBe(0);
    });

    it('should handle empty categories gracefully', async () => {
      const response = JSON.stringify({ businessName: 'Test', categories: [] });
      mockGeminiResponse(response);

      await expect(
        service.analyzeMenuPdf(Buffer.from('fake'), 'test.pdf'),
      ).rejects.toThrow('Aucun produit trouvé');
    });

    it('should handle malformed JSON from Gemini', async () => {
      mockGeminiResponse('not valid json {{{');

      await expect(
        service.analyzeMenuPdf(Buffer.from('fake'), 'test.pdf'),
      ).rejects.toThrow("format retourné par l'IA est invalide");
    });

    it('should handle Gemini SAFETY block', async () => {
      mockGeminiWithFinishReason('SAFETY');

      await expect(
        service.analyzeMenuPdf(Buffer.from('fake'), 'test.pdf'),
      ).rejects.toThrow('bloqué par les filtres de sécurité');
    });

    it('should handle Gemini MAX_TOKENS', async () => {
      mockGeminiWithFinishReason('MAX_TOKENS');

      await expect(
        service.analyzeMenuPdf(Buffer.from('fake'), 'test.pdf'),
      ).rejects.toThrow('trop volumineux');
    });

    it('should handle Gemini API error', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });
      global.fetch = mockFetch as any;

      await expect(
        service.analyzeMenuPdf(Buffer.from('fake'), 'test.pdf'),
      ).rejects.toThrow("Erreur lors de l'analyse");
    });

    it('should strip markdown fences from Gemini response', async () => {
      const response = '```json\n' + JSON.stringify({
        businessName: 'Test',
        categories: [],
      }) + '\n```';
      mockGeminiResponse(response);

      await expect(
        service.analyzeMenuPdf(Buffer.from('fake'), 'test.pdf'),
      ).rejects.toThrow('Aucun produit trouvé');
    });

    it('should truncate product names longer than 255 chars', async () => {
      const longName = 'A'.repeat(300);
      const response = JSON.stringify({
        businessName: 'Test',
        categories: [{
          name: 'Plats',
          products: [{ name: longName, price: 1000, description: '' }],
        }],
      });
      mockGeminiResponse(response);

      const result = await service.analyzeMenuPdf(Buffer.from('fake'), 'test.pdf');
      expect(result.categories[0].products[0].name.length).toBeLessThanOrEqual(255);
    });
  });
});
