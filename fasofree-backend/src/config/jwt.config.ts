import { ConfigService } from '@nestjs/config';

const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Résolution du secret JWT — source unique et fail-fast.
 *
 * JWT_SECRET est OBLIGATOIRE dans TOUTES les environnements : aucun fallback
 * dérivé (DATABASE_URL) ni valeur codée en dur. Le démarrage échoue
 * explicitement si la clé est absente ou trop courte, plutôt que de signer
 * des jetons avec un secret faible ou instable.
 *
 * Tous les consommateurs (HTTP : auth.module / jwt.strategy — WebSocket :
 * internal-chat, chat, dispatch) passent par cette fonction afin de garantir
 * que les jetons sont signés et vérifiés avec la MÊME clé.
 */
export function resolveJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET');
  if (!secret || secret.trim().length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET est obligatoire (minimum ${MIN_JWT_SECRET_LENGTH} caractères). ` +
        "Définissez une clé aléatoire forte dans l'environnement ; " +
        "aucun fallback n'est appliqué pour des raisons de sécurité.",
    );
  }
  return secret.trim();
}
