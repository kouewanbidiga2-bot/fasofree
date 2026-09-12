import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { writeFileSync } from 'fs';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Secrets indispensables au fonctionnement de l'API. En production, leur
 * absence empêche le démarrage (fail-fast) afin de ne JAMAIS tourner avec
 * une configuration dégradée ou des valeurs codées en dur.
 */
const CRITICAL_KEYS = ['JWT_SECRET', 'DATABASE_URL'];

function validateCriticalConfig(logger: Logger): void {
  const isProd = process.env.NODE_ENV === 'production';
  const missing = CRITICAL_KEYS.filter(
    (k) => !process.env[k] || process.env[k]!.trim() === '',
  );
  if (missing.length === 0) return;

  if (isProd) {
    logger.error(
      `Configuration critique manquante en production : ${missing.join(', ')}. ` +
        'Démarrage refusé (fail-fast).',
    );
    process.exit(1);
  }
  logger.warn(
    `Configuration critique manquante (mode dev) : ${missing.join(', ')}`,
  );
}

async function bootstrap() {
  const startTime = Date.now();
  const logger = new Logger('Bootstrap');

  // 0. Validation de configuration critique au démarrage.
  //    En production, on REFUSE de démarrer sans les secrets vitaux
  //    (pas de valeur par défaut, pas de secret codé en dur).
  validateCriticalConfig(logger);

  // 1. Initialisation de l'application avec Raw Body (pour Webhooks Wave/Orange)
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['verbose', 'debug', 'log', 'warn', 'error'],
  });

  // 2. Graceful Shutdown (Libère proprement le port 3000 lors de l'arrêt du serveur)
  app.enableShutdownHooks();

  // 3. Protection des en-têtes HTTP via Helmet (Optimisé pour Swagger UI)
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
    }),
  );

  // 3bis. Stockage local supprimé — tous les fichiers vont sur Cloudinary/S3

  // 4. Stratégie CORS Intelligente (Dev Local + Prod)
  const isProduction = process.env.NODE_ENV === 'production';
  const envOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  // Patterns regex autorises en prod (*.fasofree.site, *.vercel.app, *.onrender.com)
  const allowedRegexPatterns = [
    /\.fasofree\.site$/,
    /\.vercel\.app$/,
    /\.onrender\.com$/,
  ];

  const isOriginAllowed = (origin: string) => {
    if (envOrigins.length > 0 && envOrigins.includes(origin)) return true;
    return allowedRegexPatterns.some((re) => re.test(origin));
  };

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || !isProduction || isOriginAllowed(origin)) {
        // Pas d'origine (curl, serveur-à-serveur, outils) ou origine autorisée.
        callback(null, true);
      } else {
        // 🛡️ Origine refusée : on REJETTE réellement la requête
        // (l'ancien code faisait callback(null, true) = origine interdite autorisée).
        logger.warn(`CORS bloquée : ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'x-signature', // Signature HMAC pour les paiements
    ],
    credentials: true,
  });

  // 5. Validation Globale des DTOs (Strict & Typé)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 6. Filtre d'exception centralisé
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 7. Versionnage et Préfixe global d'API
  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  // 8. Documentation OpenAPI / Swagger (UX Améliorée)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('FasoFree API')
    .setDescription(
      [
        '## FasoFree — API Backend Marketplace & Livraison Burkina Faso',
        '',
        'Plateforme complète de **livraison de repas**, **courses FasoRide**, et **envoi de colis FasoColis** à Ouagadougou.',
        '',
        '### Modules principaux',
        '| Module | Description |',
        '|--------|-------------|',
        '| **Authentication** | Inscription, connexion, OTP, rôles (CLIENT, BUSINESS_ADMIN, DRIVER, SUPER_ADMIN) |',
        '| **Businesses** | Gestion des commerces, branches multi-agences, statut ouvert/fermé |',
        '| **Products** | Catalogue produits par commerce, gestion stock, disponibilité |',
        '| **Orders** | Création, suivi FSM (PENDING → PROCESSING → IN_DELIVERY → DELIVERED), annulation |',
        '| **Dispatch** | Attribution automatique livreur, cascade, timeout 10 min, refus |',
        '| **Payments** | GeniusPay (Orange Money, Moov Money, Wave), webhooks, escrow |',
        '| **Wallets** | Portefeuille marchand/agence, crédits automatiques, retraits Mobile Money |',
        '| **Financial** | Settlement marchand, commission plateforme, rapports financiers |',
        '| **Analytics** | Statistiques par agence/marque, graphiques de ventes, comparaison branches |',
        '| **Driver** | Dashboard livreur, statut disponibilité, assignation, validation OTP |',
        '| **Reviews** | Notes et avis clients, modération |',
        '| **Disputes** | Réclamations client, résolution admin |',
        '| **Chat** | Messagerie client-livreur en temps réel (Socket.IO) |',
        '| **Subscriptions** | Forfaits marchands, KYC obligatoire avant approbation |',
        '| **Notifications** | Push FCM, email (Resend), WhatsApp Cloud API |',
        '| **Stories** | Stories éphémères restaurants (likes, vues) |',
        '| **Loyalty** | Points de fidélité, programme de récompenses |',
        '| **Promotions** | Codes promo, réductions |',
        '',
        '### Rôles et permissions',
        '| Rôle | Accès |',
        '|------|-------|',
        '| `SUPER_ADMIN` | Tous les endpoints, gestion utilisateurs, finances globales |',
        '| `BUSINESS_ADMIN` | Ses propres commerces/branches, commandes, analytics, wallet |',
        '| `DRIVER` | Commandes assignées, statut disponibilité, wallet retrait |',
        '| `CLIENT` | Passer commandes, réclamations, profil, adresses, fidélité |',
        '',
        '### Authentification',
        'Tous les endpoints protégés nécessitent un token JWT dans le header `Authorization: Bearer <token>`.',
        'Le token contient `sub` (userId), `role`, et `brandId` (pour les marchands multi-agences).',
        '',
        '### Déploiement',
        '- **Backend** : Render (https://api.fasofree.site)',
        '- **Frontend Client** : Vercel (https://fasofree.site)',
        '- **Frontend Admin** : Vercel (https://admin.fasofree.site)',
        '- **Base de données** : PostgreSQL (Neon)',
        '- **Cache** : Redis (optionnel)',
        '- **Stockage fichiers** : Cloudinary',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .setContact('FasoFree', 'https://fasofree.site', 'contact@fasofree.site')
    .setLicense('Proprietary', 'https://fasofree.site/cgu')
    .addServer(`/${globalPrefix}`, 'Serveur courant')
    .addServer('/', 'Base URL (sans préfixe)')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Token JWT obtenu via POST /auth/login ou POST /auth/register',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'Inscription, connexion, OTP, rôles utilisateur')
    .addTag('Users', 'Gestion des comptes utilisateurs, profil, adresses')
    .addTag('Businesses', 'Commerces, branches multi-agences, ownership')
    .addTag('Products', 'Catalogue produits, stock, disponibilité')
    .addTag('Orders', 'Commandes clients, suivi FSM, historique')
    .addTag('Dispatch', 'Attribution livreur, cascade, timeout, refus')
    .addTag('Payments', 'Paiements GeniusPay, Orange Money, Moov Money, Wave')
    .addTag('Wallets', 'Portefeuilles marchand/livreur, crédits, retraits')
    .addTag('Financial', 'Settlement marchand, commission, rapports financiers')
    .addTag('Analytics', 'Statistiques ventes, graphiques, comparaison branches')
    .addTag('Reviews', 'Notes et avis clients')
    .addTag('Disputes', 'Réclamations client, résolution')
    .addTag('Chat', 'Messagerie temps réel client-livreur')
    .addTag('Subscriptions', 'Forfaits marchands, abonnements')
    .addTag('Notifications', 'Push, email, WhatsApp')
    .addTag('Stories', 'Stories éphémères restaurants')
    .addTag('Loyalty', 'Points de fidélité')
    .addTag('Promotions', 'Codes promo, réductions')
    .addTag('Settings', 'Configuration agence, tarification')
    .addTag('Tracking', 'Suivi en temps réel des livraisons')
    .addTag('Addresses', 'Adresses de livraison client')
    .addTag('Favorites', 'Restaurants favoris client')
    .addTag('Uploads', 'Upload fichiers vers Cloudinary')
    .addTag('Health', 'Healthcheck, statut système')
    .addTag('Seed', 'Données de test, re-seeding')
    .addTag('Ban Requests', 'Demandes de bannissement')
    .addTag('Internal Chat', 'Chat équipe admin')
    .addTag('OTP Verification', 'Vérification OTP par email')
    .addTag('KYC', 'Vérification identité marchands/livreurs')
    .addTag('Onboarding', 'Candidature marchand/livreur')
    .addTag('GeniusPay', 'Intégration paiement GeniusPay')
    .addTag('Webhooks', 'Webhooks paiement, WhatsApp')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Génère la spec JSON uniquement hors production
  if (!isProduction) {
    try {
      writeFileSync('./swagger-spec.json', JSON.stringify(document, null, 2));
    } catch (err) {
      logger.warn(`Impossible d'écrire swagger-spec.json : ${err.message}`);
    }
  }

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none', // Garde la documentation lisible au démarrage
      filter: true, // Barre de recherche intégrée dans Swagger
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'FasoFree API Docs',
  });

  // 9. Démarrage du serveur (Adapté pour Render / Cloud / Ngrok)
  const port = Number(process.env.PORT) || 3100;

  // Binding sur '0.0.0.0' impératif pour Render / Docker / Tunnels
  await app.listen(port, '0.0.0.0');

  const bootDuration = Date.now() - startTime;
  logger.log(`⚡ FasoFree Backend prêt en ${bootDuration}ms`);
  logger.log(
    `🚀 API Base URL          : http://0.0.0.0:${port}/${globalPrefix}`,
  );
  logger.log(`📚 Swagger Documentation : http://0.0.0.0:${port}/api/docs`);
  logger.log(
    `🩺 Healthcheck Endpoint  : http://0.0.0.0:${port}/${globalPrefix}/health`,
  );
}

// Capture propre des erreurs au démarrage
bootstrap().catch((err) => {
  new Logger('Bootstrap').error('❌ Échec critique lors du démarrage :', err);
  process.exit(1);
});

// 10. Résilience : les erreurs réseau transitoires ne doivent pas tuer le process
// APRÈS le bootstrap (pour ne pas masquer les erreurs de listen)
process.on('uncaughtException', (error) => {
  new Logger('Bootstrap').error('Uncaught Exception :', error?.message ?? error);
});
process.on('unhandledRejection', (reason) => {
  new Logger('Bootstrap').warn('Unhandled Rejection :', (reason as any)?.message ?? reason);
});
