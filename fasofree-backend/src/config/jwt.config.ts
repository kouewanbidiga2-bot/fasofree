import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

/**
 * Résolution du secret JWT cohérente avec le signataire (auth.module).
 *
 * En production JWT_SECRET est OBLIGATOIRE (validation au démarrage).
 * Si un jour il manquait, on dérive un secret STABLE depuis DATABASE_URL
 * (même logique que auth.module) pour que tous les consommateurs (HTTP +
 * WebSocket) utilisent la MÊME clé. Aucune valeur codée en dur.
 */
export function resolveJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET');
  if (secret && secret.length >= 32) return secret;
  const dbUrl = configService.get<string>('DATABASE_URL') || '';
  return createHash('sha256')
    .update(dbUrl + 'fasofree-jwt-fallback-2024')
    .digest('hex');
}
