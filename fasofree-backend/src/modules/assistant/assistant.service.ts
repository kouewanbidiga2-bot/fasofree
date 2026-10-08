import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Business } from '../businesses/entities/business.entity';

const DEFAULT_SUGGESTIONS = [
  'Comment commander ?',
  'Comment payer ?',
  'Où est ma commande ?',
  'Quel plat me conseilles-tu ?',
];

interface IntentDef {
  id: string;
  keywords: string[];
}

/**
 * 🤖 Assistant FasoFree — moteur local 100 % autonome (aucune clé API).
 *
 * Deux missions :
 *  1. Guider l'utilisateur sur le fonctionnement de la plateforme
 *     (commande, paiement, livraison, suivi, VIP Pass, litiges, métiers…).
 *  2. Conseiller sur le menu réel d'un restaurant : quand l'app client
 *     transmet `businessId` (page /restaurant/:id), l'assistant interroge
 *     les vrais produits du commerce et recommande des plats avec prix.
 *
 * Réponses volontairement enrichies (emojis, étapes) pour éduquer l'app et
 * rassurer l'utilisateur. Aucune donnée sensible n'est renvoyée.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly configService: ConfigService,
  ) {}

  /** Intents évalués par ordre de priorité (le premier score max gagne). */
  private readonly intents: IntentDef[] = [
    {
      id: 'order',
      keywords: [
        'commander',
        'commande',
        'acheter',
        'passer commande',
        'faire une commande',
      ],
    },
    {
      id: 'payment',
      keywords: [
        'payer',
        'paiement',
        'paye',
        'orange money',
        'orange',
        'moov',
        'wave',
        'espece',
        'cash',
        'mobile money',
        'portefeuille',
        'argent',
      ],
    },
    {
      id: 'delivery',
      keywords: [
        'livraison',
        'livreur',
        'livrer',
        'delai',
        'duree',
        'chauffeur',
        'temps de',
        'arriver',
        'longtemps',
      ],
    },
    {
      id: 'tracking',
      keywords: [
        'suivi',
        'suivre',
        'ou est',
        'ou se trouve',
        'tracking',
        'code pin',
        'pin',
        'position',
      ],
    },
    {
      id: 'menu',
      keywords: [
        'menu',
        'plat',
        'recommande',
        'conseille',
        'conseil',
        'manger',
        'restaurant',
        'carte',
        'specialite',
      ],
    },
    {
      id: 'price',
      keywords: ['prix', 'combien', 'tarif', 'cout', 'coute', 'cher', 'budget'],
    },
    {
      id: 'signup',
      keywords: [
        'inscrire',
        'inscription',
        'creer un compte',
        'cree un compte',
        'creer compte',
        'compte client',
        'enregistrer',
      ],
    },
    {
      id: 'vip',
      keywords: ['vip', 'pass', 'fidelite', 'abonnement', 'avantage', 'privilege'],
    },
    {
      id: 'dispute',
      keywords: [
        'litige',
        'reclamation',
        'plainte',
        'remboursement',
        'probleme',
        'support',
        'contacter',
        'assistance',
      ],
    },
    {
      id: 'merchant',
      keywords: [
        'marchand',
        'restaurateur',
        'vendre',
        'ouvrir un restaurant',
        'devenir livreur',
        'devenir marchand',
        'candidature',
        'business',
        'commerce',
      ],
    },
    {
      id: 'howto',
      keywords: [
        'comment',
        'aide',
        'guide',
        'fonctionne',
        'utiliser',
        'etape',
        'marche',
        'debuter',
        'commencer',
      ],
    },
    {
      id: 'thanks',
      keywords: ['merci', 'super', 'genial', 'excellent', 'parfait', 'cool'],
    },
    {
      id: 'greeting',
      keywords: ['bonjour', 'salut', 'bonsoir', 'hello', 'coucou', 'yo', 'slt', 'cc'],
    },
  ];

  meta() {
    return { name: 'Assistant FasoFree', lang: 'fr', suggestions: DEFAULT_SUGGESTIONS };
  }

  async ask(question: string, businessId?: string) {
    const q = this.normalize(question);
    if (!q) {
      // Question vide / blancs → aide générique, aucun traitement inutile.
      return {
        intent: 'fallback',
        answer: this.fallbackHelp(),
        suggestions: DEFAULT_SUGGESTIONS,
      };
    }
    const ctx = businessId ? await this.loadContext(businessId) : null;
    const intent = this.detectIntent(q);
    const answer = this.buildAnswer(intent, q, ctx);
    return { intent: intent.id, answer, suggestions: this.suggestionsFor(intent.id, ctx) };
  }

  /**
   * 🎙️ Commande vocale → action structurée (Gemini).
   * Retourne `{ action, query, message, answer }` :
   * - action : open_search | open_restaurant | open_cart | open_orders |
   *            track_order | open_checkout | none
   * - query  : terme à rechercher (pour open_search/open_restaurant)
   * - message: confirmation courte à afficher/lire
   * - answer : message (ou texte) à lire au client
   *
   * Fallback : moteur local `ask()` si GEMINI_API_KEY absente ou en erreur.
   */
  async voiceAction(transcript: string, businessId?: string) {
    const q = (transcript || '').trim();
    if (!q) {
      return { action: 'none', query: '', message: '', answer: this.fallbackHelp() };
    }

    const key = this.configService.get<string>('GEMINI_API_KEY', '');
    if (key) {
      try {
        const prompt = this.buildVoiceCommandPrompt(q);
        const raw = await this.callGeminiText(prompt);
        const parsed = this.parseVoiceCommand(raw);
        if (parsed) {
          return {
            action: parsed.action,
            query: parsed.query ?? '',
            message: parsed.message ?? '',
            answer: parsed.message ?? parsed.text ?? this.fallbackHelp(),
          };
        }
      } catch (err) {
        this.logger.warn(`[Assistant] VoiceAction Gemini indisponible: ${(err as Error).message}`);
      }
    }

    const r = await this.ask(q, businessId);
    return { action: 'none', query: '', message: r.answer, answer: r.answer };
  }

  private buildVoiceCommandPrompt(text: string): string {
    return `Tu es l'assistant de FasoFree (livraison de repas au Burkina Faso).
Analyse la commande vocale de l'utilisateur et retourne UNIQUEMENT un JSON.

Commande : "${text}"

Format de sortie strict :
{
  "action": "open_search|open_restaurant|open_cart|open_orders|track_order|open_checkout|none",
  "query": "terme de recherche si open_search ou open_restaurant, sinon vide",
  "message": "confirmation courte en français (ex: 'Voici les restaurants', 'Voilà votre panier', 'Je ne peux pas faire ça')"
}

Règles :
- "cherche/trouve un restaurant / fast-food/pizza/..." => open_search avec query = type.
- "ouvre le restaurant X / cherche X (resto)" => open_restaurant avec query = nom.
- "voir mon panier" => open_cart.
- "mes commandes" => open_orders.
- "mon suivi de commande" / "où est ma commande" => track_order.
- "passer commande/payer" => open_checkout.
- Sinon => none avec message = une réponse courte utile.
Réponds uniquement au JSON, sans markdown.`;
  }

  private parseVoiceCommand(raw: string): { action: string; query?: string; message?: string; text?: string } | null {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const obj = JSON.parse(jsonMatch[0]);
      if (!obj || typeof obj.action !== 'string') return null;
      return {
        action: String(obj.action || 'none'),
        query: typeof obj.query === 'string' ? obj.query : '',
        message: typeof obj.message === 'string' ? obj.message : undefined,
        text: typeof obj.text === 'string' ? obj.text : undefined,
      };
    } catch {
      return null;
    }
  }

  private async callGeminiText(prompt: string): Promise<string> {
    const key = this.configService.get<string>('GEMINI_API_KEY', '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      },
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const t = await response.text();
      throw new Error(`Gemini ${response.status}: ${String(t).substring(0, 200)}`);
    }
    const data = await response.json();
    const candidate = data?.candidates?.[0];
    if (!candidate) throw new Error('Gemini: réponse vide');
    if (candidate.finishReason === 'SAFETY') throw new Error('Gemini: blocage sécurité');
    return candidate.content?.parts?.[0]?.text || '';
  }

  // ─────────────────────────── Détection ───────────────────────────

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private detectIntent(q: string): IntentDef {
    let best: IntentDef = { id: 'fallback', keywords: [] };
    let bestScore = 0;
    for (const intent of this.intents) {
      const score = intent.keywords.reduce(
        (acc, kw) => (q.includes(kw) ? acc + 1 : acc),
        0,
      );
      // > strict : ordre du tableau = priorité en cas d'égalité.
      if (score > bestScore) {
        best = intent;
        bestScore = score;
      }
    }
    return best;
  }

  private async loadContext(businessId: string) {
    try {
      const business = await this.businessRepository.findOne({
        where: { id: businessId },
        // 🔒 Moindre exposition : uniquement les champs publics.
        select: { id: true, name: true },
      });
      if (!business) return null;
      const products = await this.productRepository.find({
        where: { businessId, isAvailable: true },
        select: {
          id: true,
          name: true,
          price: true,
          description: true,
          category: true,
        },
        order: { name: 'ASC' },
        take: 200,
      });
      return { business, products };
    } catch (error) {
      // Sur un endpoint public, une erreur DB ne doit jamais fuiter :
      // on retombe sur les conseils génériques.
      this.logger.warn(
        `[Assistant] Contexte menu indisponible (businessId=${businessId})`,
      );
      return null;
    }
  }

  // ─────────────────────────── Réponses ───────────────────────────

  private buildAnswer(
    intent: IntentDef,
    q: string,
    ctx: { business: Business; products: Product[] } | null,
  ): string {
    switch (intent.id) {
      case 'order':
        return (
          'Pour commander sur FasoFree 🛵 :\n\n' +
          '1. Parcourez les restaurants autour de vous ou utilisez la recherche.\n' +
          '2. Ouvrez un restaurant et ajoutez vos plats au panier.\n' +
          '3. Validez votre panier et choisissez le mode : livraison par coursier, retrait ou sur place.\n' +
          '4. Payez par mobile money (Orange Money, Moov Money, Wave) ou en espèces à la réception.\n' +
          '5. Suivez votre commande en temps réel, puis validez la réception avec votre code PIN.\n\n' +
          '👉 Ouvrez un restaurant pour commencer !'
        );
      case 'payment':
        return (
          'FasoFree accepte les paiements par mobile money 🤑 :\n\n' +
          '• Orange Money\n' +
          '• Moov Money\n' +
          '• Wave\n' +
          '• Espèces (à la livraison ou au retrait)\n\n' +
          'Vous pouvez aussi recharger votre portefeuille FasoFree pour payer plus vite.\n' +
          'Au moment de valider votre commande, choisissez simplement le mode qui vous arrange. ✅'
        );
      case 'delivery':
        return (
          'La livraison est assurée par nos chauffeurs-livreurs 🛵.\n\n' +
          'Le délai dépend de la distance et de la circulation : comptez en général de 20 à 60 minutes en ville.\n' +
          'Vous suivez votre livreur sur la carte pendant le trajet, et à la réception vous validez avec un code PIN sécurisé. 🔐'
        );
      case 'tracking':
        return (
          'Pour suivre votre commande 📍 :\n\n' +
          '1. Ouvrez votre profil puis « Historique des commandes ».\n' +
          '2. Cliquez sur la commande en cours : la position du livreur s’affiche en temps réel sur la carte.\n' +
          '3. À la livraison, le livreur vous demande votre code PIN : communiquez-le uniquement quand vous avez reçu la commande. 🔐\n\n' +
          'Une commande en cours ? Je ne peux pas accéder aux données privées, mais l’onglet « Suivi » vous montre tout. 😉'
        );
      case 'menu':
        return this.menuAdvice(q, ctx);
      case 'price':
        return (
          'Les prix des plats varient selon le restaurant 😉 : chaque plat affiche son prix sur sa page.\n\n' +
          'Ajoutez vos plats au panier pour voir le total (frais de livraison selon la distance).\n' +
          'Astuce : ouvrez un restaurant et demandez-moi « quel est le plat le moins cher ? » — je vous conseille le meilleur rapport qualité-prix. 🍽️'
        );
      case 'signup':
        return (
          'Créer un compte FasoFree est gratuit et prend 1 minute ⏱️ :\n\n' +
          '1. Touchez « Créer un compte » sur la page de connexion.\n' +
          '2. Renseignez votre email ou votre numéro de téléphone et un mot de passe.\n' +
          '3. Validez le code de confirmation reçu par email ou SMS.\n\n' +
          'Votre compte client est prêt à commander. Vous pouvez aussi vous inscrire comme marchand ou livreur (vérification d’identité obligatoire). ✅'
        );
      case 'vip':
        return (
          'Le FasoFree Pass VIP 🏅 est un abonnement qui débloque des avantages :\n\n' +
          '• Livraison préférentielle\n' +
          '• Réductions et offres exclusives\n' +
          '• Accès à des avantages partenaires\n\n' +
          'Retrouvez-le dans « VIP Pass » de votre profil pour consulter les formules et souscrire. 💳'
        );
      case 'dispute':
        return (
          'En cas de problème avec une commande (article manquant, retard, litige) 😟 :\n\n' +
          '1. Ouvrez la commande concernée.\n' +
          '2. Touchez « Ouvrir un litige » et expliquez le problème.\n' +
          '3. Notre support examine la demande et vous répond (remboursement possible si le litige est fondé).\n\n' +
          'Vous pouvez suivre l’avancement directement dans votre espace litiges. ⚖️'
        );
      case 'merchant':
        return (
          'Pour vendre sur FasoFree 🏪 :\n\n' +
          '1. Créez un compte puis déposez votre candidature marchand avec les pièces demandées.\n' +
          '2. Une fois approuvé, connectez-vous à votre espace : https://admin.fasofree.site\n' +
          '3. Ajoutez vos plats — la plateforme génère automatiquement les matricules produits, vous n’avez rien à saisir. 🔖\n' +
          '4. Gérez vos commandes, votre stock et vos statistiques depuis votre tableau de bord.\n\n' +
          'Pour devenir livreur : https://admin.fasofree.site/livreur (identité : CNI + permis requis). 🛵'
        );
      case 'howto':
        return (
          'Voici comment utiliser FasoFree 🚀 :\n\n' +
          '1. Créez un compte gratuit (email ou téléphone).\n' +
          '2. Cherchez un restaurant ou un plat depuis l’accueil.\n' +
          '3. Ajoutez vos plats au panier puis validez la commande (livraison ou retrait).\n' +
          '4. Payez par mobile money ou en espèces.\n' +
          '5. Suivez la commande en direct et validez la réception avec votre code PIN.\n\n' +
          'Vous pouvez aussi envoyer un colis (service de course) et profiter du VIP Pass. Une question précise ? Je suis là ! 🤖'
        );
      case 'thanks':
        return 'Avec plaisir ! 😊 N’hésitez pas si vous avez d’autres questions sur FasoFree.';
      case 'greeting':
        return (
          'Bonjour 👋 Bienvenue sur FasoFree !\n\n' +
          'Je suis votre assistant : je peux vous guider dans l’application,\n' +
          'répondre à vos questions et vous conseiller un bon plat. 🍽️\n\n' +
          'Comment puis-je vous aider ?'
        );
      default:
        return this.fallbackHelp();
    }
  }

  private fallbackHelp(): string {
    return (
      'Je suis l’assistant FasoFree 🤖 — je vous guide sur la plateforme et je conseille des plats.\n\n' +
      'Essayez par exemple :\n' +
      '• « Comment commander ? »\n' +
      '• « Comment payer ? »\n' +
      '• « Où est ma commande ? »\n' +
      '• « Devenir marchand / livreur »\n' +
      '• « Quel plat me conseilles-tu ? » (ouvrez d’abord la page d’un restaurant)'
    );
  }

  private menuAdvice(
    q: string,
    ctx: { business: Business; products: Product[] } | null,
  ): string {
    if (!ctx) {
      return (
        'Pour vous conseiller sur un menu 🍽️, ouvrez la page du restaurant qui vous intéresse,\n' +
        'puis posez-moi la question : je verrai ses plats et ses prix réels.\n\n' +
        'En attendant, dites-moi le type de cuisine que vous cherchez (grillades, fast-food, plats locaux…) !'
      );
    }
    const available = ctx.products;
    if (available.length === 0) {
      return (
        `Chez ${ctx.business.name}, le menu n'est pas encore disponible en ligne 🙁\n\n` +
        'Vous pouvez repasser plus tard ou essayer un autre restaurant autour de vous.'
      );
    }
    // « Le moins cher » / budget → tri par prix croissant.
    const byPrice =
      q.includes('pas cher') ||
      q.includes('bon marche') ||
      q.includes('economique') ||
      q.includes('budget') ||
      q.includes('moins cher');
    const picks = byPrice
      ? [...available].sort((a, b) => Number(a.price) - Number(b.price))
      : available;
    const top = picks.slice(0, 3);
    const lines = top.map(
      (p) =>
        `• ${p.name} — ${this.fmtPrice(p.price)}${p.description ? ` : ${this.shorten(p.description)}` : ''}`,
    );
    return (
      `À ${ctx.business.name}, voici ce que je vous conseille ${byPrice ? '(les plus abordables) 💰' : '🍽️'} :\n\n` +
      lines.join('\n') +
      '\n\nVoulez-vous plus de détails, ou un autre type de plat ?'
    );
  }

  // ─────────────────────────── Suggestions ───────────────────────────

  private suggestionsFor(intentId: string, ctx: unknown): string[] {
    switch (intentId) {
      case 'menu':
        return ctx
          ? ['Le plat le moins cher', 'Un plat populaire', 'Comment commander ?', "Où est ma commande ?"]
          : ['Quel plat me conseilles-tu ?', 'Comment commander ?', 'Comment payer ?', 'Combien coûte la livraison ?'];
      case 'order':
        return ['Comment payer ?', 'Comment suivre ma commande ?', 'Combien coûte la livraison ?', 'Quel plat me conseilles-tu ?'];
      case 'payment':
        return ['Comment commander ?', 'Recharger mon portefeuille', "Où est ma commande ?", 'Les espèces sont acceptées ?'];
      case 'delivery':
      case 'tracking':
        return ['Comment commander ?', 'Comment payer ?', 'Combien coûte la livraison ?', 'Quel plat me conseilles-tu ?'];
      case 'price':
        return ['Quel plat me conseilles-tu ?', 'Le plat le moins cher', 'Comment commander ?', 'Comment payer ?'];
      case 'signup':
        return ['Comment commander ?', 'Devenir marchand', 'Devenir livreur', 'Comment payer ?'];
      case 'vip':
        return ['Quels sont les avantages ?', 'Comment commander ?', 'Comment payer ?', "Où est ma commande ?"];
      case 'dispute':
        return ['Comment commander ?', "Où est ma commande ?", 'Comment payer ?', 'Quel plat me conseilles-tu ?'];
      case 'merchant':
        return ['Comment commander ?', 'Devenir livreur', 'Comment créer un compte ?', 'Quel plat me conseilles-tu ?'];
      case 'howto':
        return ['Comment commander ?', 'Comment payer ?', 'Devenir marchand', 'Devenir livreur'];
      case 'thanks':
        return DEFAULT_SUGGESTIONS;
      case 'greeting':
        return ['Comment commander ?', 'Comment payer ?', 'Devenir marchand', 'Quel plat me conseilles-tu ?'];
      default:
        return DEFAULT_SUGGESTIONS;
    }
  }

  // ─────────────────────────── Helpers ───────────────────────────

  private fmtPrice(price: number | string | null | undefined): string {
    if (price === null || price === undefined) return 'prix non affiché';
    const n = typeof price === 'string' ? parseFloat(price) : price;
    if (!Number.isFinite(n)) return 'prix non affiché';
    return `${n.toLocaleString('fr-FR')} FCFA`;
  }

  private shorten(text: string, max = 60): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max)}…` : clean;
  }
}