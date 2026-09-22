import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImportCategoryDto, CatalogImportResultDto } from './dto/import-catalog.dto';

/**
 * Service d'import de catalogue via PDF + Gemini 1.5 Flash.
 *
 * Étapes :
 * 1. Reçoit le PDF uploadé (buffer)
 * 2. Envoie à Gemini 1.5 Flash avec un prompt structuré
 * 3. Parse et valide le JSON retourné
 * 4. Retourne un preview éditable au frontend
 */
@Injectable()
export class PdfImportService {
  private readonly logger = new Logger(PdfImportService.name);
  private readonly geminiApiKey: string;
  private readonly geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(private readonly configService: ConfigService) {
    this.geminiApiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    if (!this.geminiApiKey) {
      this.logger.warn('[PDF Import] GEMINI_API_KEY manquante — import PDF désactivé');
    }
  }

  /**
   * Vérifie si le service est disponible (clé API configurée).
   */
  isAvailable(): boolean {
    return !!this.geminiApiKey;
  }

  /**
   * Analyse un PDF de menu et retourne un catalogue structuré.
   */
  async analyzeMenuPdf(pdfBuffer: Buffer, filename: string): Promise<CatalogImportResultDto> {
    if (!this.isAvailable()) {
      throw new BadRequestException(
        'Service d\'import PDF non configuré. Contactez l\'administrateur.',
      );
    }

    // 1. Convertir le PDF en base64
    const pdfBase64 = pdfBuffer.toString('base64');

    // 2. Construire le prompt avec few-shot examples
    const prompt = this.buildPrompt();

    // 3. Appeler Gemini 1.5 Flash
    const geminiResponse = await this.callGemini(pdfBase64, prompt);

    // 4. Parser et valider le JSON
    const result = this.parseAndValidate(geminiResponse);

    this.logger.log(
      `[PDF Import] PDF "${filename.replace(/[\r\n]/g, '_').substring(0, 100)}" analysé — ${result.totalProducts} produits trouvés dans ${result.categories.length} catégories`,
    );

    return result;
  }

  /**
   * Prompt few-shot optimisé pour l'extraction de menus.
   */
  private buildPrompt(): string {
    return `Tu es un assistant spécialisé dans l'extraction de menus de restaurants depuis des PDF.

TASK: Analyse ce PDF de menu de restaurant et extrais TOUTS les produits (plats, boissons, desserts, etc.) en JSON structuré.

RULES:
- Extrais TOUS les produits visibles, même partiellement lisibles
- Les prix doivent être en FCFA (entiers, sans décimales)
- Si un prix n'est pas visible, mets 0 (le marchand corrigera)
- Les catégories doivent être logiques (Plats principaux, Boissons, Desserts, Accompagnements, etc.)
- Les descriptions doivent être courtes (1 ligne max)
- Si pas de description visible, mets une description vide
- Le businessName est le nom du restaurant/marchand visible sur le menu
- Si pas de nom visible, mets "Restaurant"

RESPONSE FORMAT (JSON strict, pas de texte avant/après):
{
  "businessName": "Nom du restaurant",
  "categories": [
    {
      "name": "Nom de la catégorie",
      "products": [
        {
          "name": "Nom du plat",
          "description": "Courte description",
          "price": 1500,
          "type": "plat"
        }
      ]
    }
  ]
}

EXAMPLES:

Input: Menu papier avec "Chez Toto - Tiep 1500F, Poisson 2000F, Coca 500F"
Output:
{
  "businessName": "Chez Toto",
  "categories": [
    {
      "name": "Plats principaux",
      "products": [
        { "name": "Tiep", "description": "", "price": 1500, "type": "plat" },
        { "name": "Poisson", "description": "", "price": 2000, "type": "plat" }
      ]
    },
    {
      "name": "Boissons",
      "products": [
        { "name": "Coca", "description": "", "price": 500, "type": "boisson" }
      ]
    }
  ]
}

Input: Menu avec "MENU DU JOUR - Poulet braisé 2500F, Jus de baobab 300F, Gri-gri 1000F"
Output:
{
  "businessName": "Restaurant",
  "categories": [
    {
      "name": "Menu du jour",
      "products": [
        { "name": "Poulet braisé", "description": "", "price": 2500, "type": "plat" },
        { "name": "Gri-gri", "description": "", "price": 1000, "type": "accompagnement" }
      ]
    },
    {
      "name": "Boissons",
      "products": [
        { "name": "Jus de baobab", "description": "", "price": 300, "type": "boisson" }
      ]
    }
  ]
}

IMPORTANT: Retourne UNIQUEMENT le JSON, pas de texte explicatif.`;
  }

  /**
   * Appelle l'API Gemini 1.5 Flash avec le PDF.
   */
  private async callGemini(pdfBase64: string, prompt: string): Promise<string> {
    const url = `${this.geminiBaseUrl}/models/gemini-1.5-flash:generateContent`;

    const body = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1, // Faible température = plus déterministe
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.geminiApiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorText = await response.text();
      const safeError = String(errorText).substring(0, 500).replace(/[\r\n]/g, ' ');
      this.logger.error(`[PDF Import] Erreur Gemini API: ${response.status} - ${safeError}`);
      throw new BadRequestException('Erreur lors de l\'analyse du PDF. Réessayez.');
    }

    const data = await response.json();

    // Extraire le texte de la réponse Gemini
    const candidate = data?.candidates?.[0];
    if (!candidate) {
      throw new BadRequestException('Gemini n\'a pas pu analyser ce PDF. Essayez avec un document plus clair.');
    }
    if (candidate.finishReason === 'SAFETY') {
      throw new BadRequestException('Le contenu du PDF a été bloqué par les filtres de sécurité. Essayez avec un autre document.');
    }
    if (candidate.finishReason === 'MAX_TOKENS') {
      throw new BadRequestException('Le PDF est trop volumineux pour être analysé en une fois. Essayez avec un document plus court.');
    }
    const text = candidate.content?.parts?.[0]?.text;
    if (!text) {
      throw new BadRequestException('Gemini n\'a pas pu analyser ce PDF. Essayez avec un document plus clair.');
    }

    return text;
  }

  /**
   * Parse le JSON retourné par Gemini et valide la structure.
   */
  private parseAndValidate(rawJson: string): CatalogImportResultDto {
    let parsed: any;

    try {
      // Nettoyer les éventuels markdown fences
      const cleaned = rawJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new BadRequestException(
        'Le format retourné par l\'IA est invalide. Réessayez avec un autre PDF.',
      );
    }

    // Valider la structure de base
    if (!parsed.businessName || typeof parsed.businessName !== 'string') {
      parsed.businessName = 'Restaurant';
    }

    if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
      throw new BadRequestException(
        'Aucun produit trouvé dans le PDF. Vérifiez que le document contient un menu lisible.',
      );
    }

    // Valider et nettoyer chaque catégorie et produit
    const categories: ImportCategoryDto[] = [];
    let totalProducts = 0;

    for (const cat of parsed.categories) {
      if (!cat.name || !Array.isArray(cat.products) || cat.products.length === 0) {
        continue; // Sauter les catégories vides
      }

      const products = cat.products
        .filter((p: any) => p.name && typeof p.name === 'string')
        .map((p: any) => ({
          name: String(p.name).trim().substring(0, 255),
          description: p.description ? String(p.description).trim().substring(0, 500) : '',
          price: this.validatePrice(p.price),
          category: cat.name.trim().substring(0, 100),
          type: p.type ? String(p.type).trim().substring(0, 100) : 'plat',
          imageUrl: p.imageUrl || undefined,
        }));

      if (products.length > 0) {
        categories.push({ name: cat.name.trim(), products });
        totalProducts += products.length;
      }
    }

    if (totalProducts === 0) {
      throw new BadRequestException(
        'Aucun produit valide trouvé. Le PDF peut être illisible ou ne contient pas de menu.',
      );
    }

    return {
      businessName: parsed.businessName.trim(),
      categories,
      totalProducts,
    };
  }

  /**
   * Valide et normalise un prix.
   * Accepte : nombre, string avec "F", "FCFA", espaces, etc.
   */
  private validatePrice(raw: any): number {
    if (typeof raw === 'number' && raw > 0) {
      return Math.round(raw);
    }

    if (typeof raw === 'string') {
      // Extraire les chiffres
      const numbers = raw.replace(/[^\d]/g, '');
      const price = parseInt(numbers, 10);
      if (price > 0 && price < 100000) {
        return price;
      }
    }

    return 0; // Prix inconnu — le marchand corrigera
  }
}
