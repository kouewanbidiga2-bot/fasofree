/**
 * Configuration partagée des outils de seed (dev/test uniquement).
 *
 * SeedModule n'est jamais chargé en production (app.module.ts) et la
 * commande CLI ne peut pas créer de comptes de test hors dev/test
 * (assertSeedAllowed). Les mots de passe sont surchargeables via l'env
 * SEED_TEST_PASSWORD pour éviter toute valeur en dur dans la source.
 */

// Mot de passe unique des comptes de démonstration.
export const SEED_TEST_PASSWORD =
  process.env.SEED_TEST_PASSWORD || 'Test@12345';

// Rounds bcrypt alignés sur le durcissement du lot HIGH (reset-super-admin).
export const BCRYPT_ROUNDS = 12;

/**
 * Interdit l'exécution d'une commande de création de comptes de test
 * hors des environnements de développement/test. À appeler en tête des
 * commandes seed qui créent ou réinitialisent des comptes :
 *   seed:test-data, seed:chitir-chicken, seed:get-credentials.
 */
export function assertSeedAllowed(commandName: string): void {
  const env = process.env.NODE_ENV;
  if (!env || env === 'development' || env === 'test') return;
  console.error(
    `❌ Commande ${commandName} interdite dans l'environnement '${env}' (réservée dev/test).`,
  );
  process.exit(1);
}