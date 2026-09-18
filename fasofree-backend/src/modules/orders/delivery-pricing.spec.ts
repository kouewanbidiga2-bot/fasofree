import { DeliveryPricingService, DeliveryTier, VehicleType } from './delivery-pricing.service';

const DAY_DATE = new Date('2024-01-15T14:00:00'); // 14:00 Ouaga
const NIGHT_DATE = new Date('2024-01-15T22:00:00'); // 22:00 Ouaga

describe('DeliveryPricingService — tranches tarifaires + surcharge nuit', () => {
  let service: DeliveryPricingService;

  beforeEach(() => {
    service = new DeliveryPricingService({
      get: jest.fn((key: string) => {
        if (key === 'DELIVERY_TIERS') return undefined;
        return undefined;
      }),
    } as any);
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getFee = (km: number, isNight = false) =>
    service.calculateDeliveryFee(km, VehicleType.MOTORCYCLE, 1.0, undefined, isNight ? NIGHT_DATE : DAY_DATE).fee;

  // ─── Tests tranches JOUR ──────────────────────────────────────────────────

  describe('Tranches JOUR (sans surcharge)', () => {
    it('0 km → 1750 (milieu tranche 0-15)', () => {
      expect(getFee(0)).toBe(1750);
    });

    it('5 km → 1750 (tranche 0-15)', () => {
      expect(getFee(5)).toBe(1750);
    });

    it('15 km → 1750 (limite tranche 0-15)', () => {
      expect(getFee(15)).toBe(1750);
    });

    it('16 km → 2250 (tranche 16-20)', () => {
      expect(getFee(16)).toBe(2250);
    });

    it('18 km → 2250 (tranche 16-20)', () => {
      expect(getFee(18)).toBe(2250);
    });

    it('20 km → 2250 (limite tranche 16-20)', () => {
      expect(getFee(20)).toBe(2250);
    });

    it('21 km → 2750 (tranche 21-25)', () => {
      expect(getFee(21)).toBe(2750);
    });

    it('23 km → 2750 (tranche 21-25)', () => {
      expect(getFee(23)).toBe(2750);
    });

    it('25 km → 2750 (limite tranche 21-25)', () => {
      expect(getFee(25)).toBe(2750);
    });

    it('26 km → 3250 (tranche 26-30)', () => {
      expect(getFee(26)).toBe(3250);
    });

    it('28 km → 3250 (tranche 26-30)', () => {
      expect(getFee(28)).toBe(3250);
    });

    it('30 km → 3250 (limite tranche 26-30)', () => {
      expect(getFee(30)).toBe(3250);
    });

    it('31 km → 3750 (au-delà 30km)', () => {
      expect(getFee(31)).toBe(3750);
    });

    it('50 km → 3750 (au-delà 30km)', () => {
      expect(getFee(50)).toBe(3750);
    });
  });

  // ─── Tests tranches NUIT (+500 FCFA) ──────────────────────────────────────

  describe('Tranches NUIT (+500 FCFA)', () => {
    it('0 km nuit → 2250', () => {
      expect(getFee(0, true)).toBe(2250); // 1750 + 500
    });

    it('15 km nuit → 2250', () => {
      expect(getFee(15, true)).toBe(2250);
    });

    it('16 km nuit → 2750', () => {
      expect(getFee(16, true)).toBe(2750);
    });

    it('20 km nuit → 2750', () => {
      expect(getFee(20, true)).toBe(2750);
    });

    it('21 km nuit → 3250', () => {
      expect(getFee(21, true)).toBe(3250);
    });

    it('25 km nuit → 3250', () => {
      expect(getFee(25, true)).toBe(3250);
    });

    it('26 km nuit → 3750', () => {
      expect(getFee(26, true)).toBe(3750);
    });

    it('30 km nuit → 3750', () => {
      expect(getFee(30, true)).toBe(3750);
    });

    it('31 km nuit → 4250', () => {
      expect(getFee(31, true)).toBe(4250);
    });
  });

  // ─── Résultat complet ────────────────────────────────────────────────────

  describe('Retourne l\'objet complet avec détails', () => {
    it('contient tier, isNight, nightSurcharge, baseFee', () => {
      const result = service.calculateDeliveryFee(10, VehicleType.MOTORCYCLE, 1.0, undefined, DAY_DATE);
      expect(result).toHaveProperty('fee', 1750);
      expect(result).toHaveProperty('distanceKm', 10);
      expect(result.tier).toEqual({ minKm: 0, maxKm: 15, minPrice: 1500, maxPrice: 2000 });
      expect(result.isNight).toBe(false);
      expect(result.nightSurcharge).toBe(0);
      expect(result.baseFee).toBe(1750);
      expect(result.vehicleType).toBe(VehicleType.MOTORCYCLE);
    });

    it('nuit ajoute nightSurcharge=500', () => {
      const result = service.calculateDeliveryFee(10, VehicleType.MOTORCYCLE, 1.0, undefined, NIGHT_DATE);
      expect(result.isNight).toBe(true);
      expect(result.nightSurcharge).toBe(500);
      expect(result.fee).toBe(2250);
    });
  });

  // ─── Compatibilité SettingsService (override statique) ────────────────────

  describe('Compatibilité override statique (ancien format linéaire)', () => {
    afterEach(() => {
      DeliveryPricingService.override = null;
    });

    it('utilise l\'override si présent', () => {
      DeliveryPricingService.override = {
        [VehicleType.MOTORCYCLE]: { baseFee: 1000, ratePerKm: 200 },
      };
      const fee = service.calculateDeliveryFee(5).fee;
      expect(fee).toBe(2000);
    });

    it('retourne tier factice avec minPrice=maxPrice=fee', () => {
      DeliveryPricingService.override = {
        [VehicleType.MOTORCYCLE]: { baseFee: 1000, ratePerKm: 200 },
      };
      const result = service.calculateDeliveryFee(5);
      expect(result.tier.minPrice).toBe(result.fee);
      expect(result.tier.maxPrice).toBe(result.fee);
      expect(result.isNight).toBe(false);
    });
  });
});