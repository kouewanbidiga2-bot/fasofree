import {
  PUSH_CAMPAIGN_BASE_PRICE_XOF,
  PUSH_CAMPAIGN_PRICE_DEFAULTS,
  applyPushCampaignPricing,
  pushCampaignPriceCache,
  pushCampaignPricingTable,
  resolvePushCampaignPrice,
} from './push-campaign-pricing';
import { PushCampaignAudience } from './entities/push-campaign.entity';

/**
 * Grille tarifaire des campagnes push auto-service (Lot 3.1).
 *
 * Le point CRITIQUE : une grille partielle ou corrompue ne doit JAMAIS rendre
 * une audience gratuite par accident (ce serait une fuite de revenus et un
 * appel au spam). On vérifie donc systématiquement le repli sur les défauts.
 */
describe('push-campaign-pricing', () => {
  afterEach(() => {
    // Le cache est un état de MODULE : on le remet aux défauts entre les tests
    // pour qu'aucun résultat ne dépende de l'ordre d'exécution.
    applyPushCampaignPricing(null);
  });

  it('applique les tarifs par défaut (ALL_CLIENTS « premium »)', () => {
    expect(pushCampaignPricingTable()).toEqual({
      OWN_CLIENTS: 100,
      OWN_DRIVERS: 100,
      ALL_CLIENTS: 2500,
    });
  });

  it('résout le prix d’une audience depuis la grille', () => {
    expect(resolvePushCampaignPrice(PushCampaignAudience.ALL_CLIENTS)).toBe(
      2500,
    );
    expect(resolvePushCampaignPrice(PushCampaignAudience.OWN_DRIVERS)).toBe(
      100,
    );
  });

  it('applique une grille enregistrée par le super-admin', () => {
    applyPushCampaignPricing({ ALL_CLIENTS: 5000, OWN_CLIENTS: 200 });

    expect(resolvePushCampaignPrice(PushCampaignAudience.ALL_CLIENTS)).toBe(
      5000,
    );
    expect(resolvePushCampaignPrice(PushCampaignAudience.OWN_CLIENTS)).toBe(
      200,
    );
    // Clé absente → défaut, jamais gratuité.
    expect(resolvePushCampaignPrice(PushCampaignAudience.OWN_DRIVERS)).toBe(
      100,
    );
  });

  it('accepte 0 (campagne offerte volontairement)', () => {
    applyPushCampaignPricing({ ALL_CLIENTS: 0 });
    expect(resolvePushCampaignPrice(PushCampaignAudience.ALL_CLIENTS)).toBe(0);
  });

  it('ignore les valeurs invalides (jamais de gratuité accidentelle)', () => {
    applyPushCampaignPricing({
      ALL_CLIENTS: 'pas-un-nombre',
      OWN_CLIENTS: -50,
      OWN_DRIVERS: null,
    });

    expect(resolvePushCampaignPrice(PushCampaignAudience.ALL_CLIENTS)).toBe(
      2500,
    );
    expect(resolvePushCampaignPrice(PushCampaignAudience.OWN_CLIENTS)).toBe(
      100,
    );
    expect(resolvePushCampaignPrice(PushCampaignAudience.OWN_DRIVERS)).toBe(
      100,
    );
  });

  it('accepte une grille partielle sans perdre les autres audiences', () => {
    applyPushCampaignPricing({ ALL_CLIENTS: 3000 });
    expect(pushCampaignPricingTable()).toEqual({
      OWN_CLIENTS: 100,
      OWN_DRIVERS: 100,
      ALL_CLIENTS: 3000,
    });
  });

  it('utilise le repli d’environnement quand aucune audience n’est fournie', () => {
    expect(resolvePushCampaignPrice(null, '250')).toBe(250);
  });

  it('retombe sur le prix de base quand le repli est invalide', () => {
    expect(resolvePushCampaignPrice(null, 'x')).toBe(
      PUSH_CAMPAIGN_BASE_PRICE_XOF,
    );
  });

  it('la grille prime sur le repli d’environnement', () => {
    applyPushCampaignPricing({ ALL_CLIENTS: 4000 });
    expect(
      resolvePushCampaignPrice(PushCampaignAudience.ALL_CLIENTS, '100'),
    ).toBe(4000);
  });

  it('expose des défauts cohérents avec la grille', () => {
    expect(PUSH_CAMPAIGN_PRICE_DEFAULTS.ALL_CLIENTS).toBe(2500);
    expect(pushCampaignPriceCache.ALL_CLIENTS).toBe(2500);
  });
});
