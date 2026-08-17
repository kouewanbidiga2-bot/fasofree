import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { writeFileSync } from 'fs';
import { join } from 'path';
import * as express from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const startTime = Date.now();
  const logger = new Logger('Bootstrap');

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

  // 3bis. Fichiers uploadés en mode local (fallback dev sans S3) — ex: documents KYC
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // 4. Stratégie CORS Intelligente (Dev Local + Prod)
  const isProduction = process.env.NODE_ENV === 'production';
  const envOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  // Patterns regex autorises en prod (*.vercel.app, *.onrender.com)
  const allowedRegexPatterns = [
    /\.vercel\.app$/,
    /\.onrender\.com$/,
  ];

  const localDevOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
  ];

  const isOriginAllowed = (origin: string) => {
    if (envOrigins.includes(origin)) return true;
    return allowedRegexPatterns.some((re) => re.test(origin));
  };

  const allowedOrigins = isProduction
    ? envOrigins
    : [...localDevOrigins, ...envOrigins];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || !isProduction || isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS bloquee : ${origin}`);
        callback(new Error(`CORS non autorise pour : ${origin}`));
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
      'Spécification OpenAPI officielle du backend FasoFree - Marketplace & Livraison à Ouagadougou',
    )
    .setVersion('1.0.0')
    .addServer(`/${globalPrefix}`, 'Serveur courant')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Saisissez votre token JWT',
        in: 'header',
      },
      'JWT-auth',
    )
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

  // 10. Résilience : une erreur réseau transitoire (ex: reset TLS du cache Redis
  // Upstash dans cache-manager-redis-yet) ne doit pas tuer le process.
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception :', error?.message ?? error);
  });
  process.on('unhandledRejection', (reason) => {
    logger.warn('Unhandled Rejection :', (reason as any)?.message ?? reason);
  });

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
