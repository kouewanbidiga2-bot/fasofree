import { NestFactory } from '@nestjs/core';
import { CommandModule, CommandService } from 'nestjs-command';
import { SeedModule } from './modules/seed/seed.module';

/**
 * 🧩 Point d'entrée CLI (nestjs-command).
 * Utilisé par `npm run command <command>` pour exécuter des commandes
 * (ex : `npm run command seed:test-data`).
 *
 * Contexte léger (SeedModule) : pas de serveur HTTP, pas de Redis/Firebase.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    await app.select(CommandModule).get(CommandService).exec();
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('❌ Échec de la commande CLI :', err?.message ?? err);
  process.exit(1);
});
