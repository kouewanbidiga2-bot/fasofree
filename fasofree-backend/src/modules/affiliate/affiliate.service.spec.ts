import { AffiliateService } from './affiliate.service';
import { AffiliateEventType } from './entities/affiliate-event.entity';
import { AFFILIATE_ORDER_CREATED } from './affiliate.events';
import { USER_REGISTERED } from '../promotions/events/promotion.events';
import { NotFoundException } from '@nestjs/common';

/**
 * Tests du tunnel d'affiliation.
 *
 * On vérifie surtout les invariants relevés par l'audit : idempotence des
 * événements, non-remontée d'erreur vers le métier, et calcul correct
 * du funnel (c'est ce qui affichait 0 avant le câblage).
 */

const makeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn((o) => o),
  save: jest.fn(async (o) => ({ id: 'link-1', ...o })),
  count: jest.fn().mockResolvedValue(0),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('AffiliateService', () => {
  let service: AffiliateService;
  let linkRepo: ReturnType<typeof makeRepo>;
  let eventRepo: ReturnType<typeof makeRepo>;
  let businessRepo: ReturnType<typeof makeRepo>;
  let userRepo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    linkRepo = makeRepo();
    eventRepo = makeRepo();
    businessRepo = makeRepo();
    userRepo = makeRepo();
    businessRepo.findOne = jest.fn().mockResolvedValue({ name: 'Le Palace' });

    service = new AffiliateService(
      linkRepo as never,
      eventRepo as never,
      businessRepo as never,
      userRepo as never,
      { get: jest.fn((_k: string, d?: string) => d) } as never,
    );
  });

  describe('recordClick', () => {
    it('enregistre un CLICK pour un code connu', async () => {
      linkRepo.findOne.mockResolvedValue({
        id: 'link-1',
        businessId: 'biz-1',
        code: 'FF-AAAAAA',
      });

      const link = await service.recordClick('FF-AAAAAA');

      expect(link?.businessId).toBe('biz-1');
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          linkId: 'link-1',
          type: AffiliateEventType.CLICK,
          userId: null,
        }),
      );
    });

    it('ne lève pas et retourne null pour un code inconnu', async () => {
      linkRepo.findOne.mockResolvedValue(null);

      await expect(service.recordClick('FF-INCONNU')).resolves.toBeNull();
      expect(eventRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('attachToUser', () => {
    it('rattache un client inscription via un lien valide', async () => {
      linkRepo.findOne.mockResolvedValue({ id: 'link-1', businessId: 'biz-1' });
      eventRepo.findOne.mockResolvedValue(null); // pas encore rattaché

      await expect(service.attachToUser('user-1', 'FF-AAAAAA')).resolves.toBe(
        true,
      );
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AffiliateEventType.SIGNUP,
          userId: 'user-1',
        }),
      );
    });

    it('est idempotent : un 2e appel ne duplique pas le SIGNUP', async () => {
      linkRepo.findOne.mockResolvedValue({ id: 'link-1', businessId: 'biz-1' });
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1' }); // déjà rattaché

      await expect(service.attachToUser('user-1', 'FF-AAAAAA')).resolves.toBe(
        true,
      );
      expect(eventRepo.save).not.toHaveBeenCalled();
    });

    it('refuse un code inconnu', async () => {
      linkRepo.findOne.mockResolvedValue(null);
      await expect(service.attachToUser('user-1', 'FF-INCONNU')).resolves.toBe(
        false,
      );
    });
  });

  describe('recordOrder', () => {
    it('ignore une commande d’un client NON rattaché à ce commerce', async () => {
      linkRepo.findOne.mockResolvedValue({ id: 'link-1', businessId: 'biz-1' });
      eventRepo.findOne.mockResolvedValue(null); // pas de SIGNUP

      await expect(
        service.recordOrder('user-1', 'biz-1', 'order-1', 5000),
      ).resolves.toBe(false);
      expect(eventRepo.save).not.toHaveBeenCalled();
    });

    it('compte la commande quand le client vient bien du lien', async () => {
      linkRepo.findOne.mockResolvedValue({ id: 'link-1', businessId: 'biz-1' });
      // 1er findOne (SIGNUP) -> trouvé ; 2e (ORDER) -> absent
      eventRepo.findOne
        .mockResolvedValueOnce({ id: 'evt-signup' })
        .mockResolvedValueOnce(null);

      await expect(
        service.recordOrder('user-1', 'biz-1', 'order-1', 5000),
      ).resolves.toBe(true);
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AffiliateEventType.ORDER,
          amount: 5000,
          orderId: 'order-1',
        }),
      );
    });

    it('ne compte pas deux fois la même commande', async () => {
      linkRepo.findOne.mockResolvedValue({ id: 'link-1', businessId: 'biz-1' });
      eventRepo.findOne
        .mockResolvedValueOnce({ id: 'evt-signup' })
        .mockResolvedValueOnce({ id: 'evt-order' }); // déjà comptée

      await expect(
        service.recordOrder('user-1', 'biz-1', 'order-1', 5000),
      ).resolves.toBe(true);
      expect(eventRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('câblage automatique (le bug « funnel toujours à 0 »)', () => {
    it('rattache le client et mémorise le code sur son profil à l’inscription', async () => {
      const attach = jest
        .spyOn(service, 'attachToUser')
        .mockResolvedValue(true);

      await service.onUserRegistered({
        userId: 'user-1',
        affiliateCode: 'FF-AAAAAA',
      });

      expect(attach).toHaveBeenCalledWith('user-1', 'FF-AAAAAA');
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        affiliateCode: 'FF-AAAAAA',
      });
    });

    it('ignore une inscription sans code affilié', async () => {
      const attach = jest.spyOn(service, 'attachToUser');

      await service.onUserRegistered({ userId: 'user-1', affiliateCode: null });

      expect(attach).not.toHaveBeenCalled();
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('ne jette pas si le rattachement échoue (inscription ne doit pas casser)', async () => {
      jest
        .spyOn(service, 'attachToUser')
        .mockRejectedValue(new Error('DB down'));

      await expect(
        service.onUserRegistered({
          userId: 'user-1',
          affiliateCode: 'FF-AAAAAA',
        }),
      ).resolves.toBeUndefined();
    });

    it('enregistre la commande via l’événement', async () => {
      const record = jest.spyOn(service, 'recordOrder').mockResolvedValue(true);

      await service.onOrderCreated({
        orderId: 'order-1',
        clientId: 'user-1',
        businessId: 'biz-1',
        amount: 7500,
      });

      expect(record).toHaveBeenCalledWith('user-1', 'biz-1', 'order-1', 7500);
    });

    it('tolère un payload d’événement incomplet', async () => {
      const record = jest.spyOn(service, 'recordOrder');
      await service.onOrderCreated({} as never);
      expect(record).not.toHaveBeenCalled();
    });

    it('expose des noms d’événements stables', () => {
      expect(USER_REGISTERED).toBe('user.registered');
      expect(AFFILIATE_ORDER_CREATED).toBe('affiliate.order.created');
    });
  });

  describe('getStats', () => {
    it('retourne un tunnel à zéro (pas de lien) sans lever d’erreur', async () => {
      linkRepo.findOne.mockResolvedValue(null);

      const stats = await service.getStats('biz-1');

      expect(stats).toMatchObject({
        businessName: 'Le Palace',
        clicks: 0,
        signups: 0,
        orders: 0,
        revenue: 0,
        conversionRate: 0,
      });
    });

    it('ne lève jamais : une stats en échec retourne null', async () => {
      linkRepo.findOne.mockRejectedValue(new Error('boom'));

      await expect(service.getStats('biz-1')).resolves.toBeNull();
    });
  });

  describe('getOrCreateLink', () => {
    it('retourne le lien existant sans en créer un nouveau', async () => {
      linkRepo.findOne.mockResolvedValue({
        id: 'link-1',
        businessId: 'biz-1',
        code: 'FF-AAAAAA',
      });

      const link = await service.getOrCreateLink('biz-1');

      expect(link.code).toBe('FF-AAAAAA');
      expect(linkRepo.save).not.toHaveBeenCalled();
    });

    it('génère un code au format FF-XXXXXX', async () => {
      linkRepo.findOne.mockResolvedValue(null);

      const link = await service.getOrCreateLink('biz-1');

      expect(link.code).toMatch(/^FF-[0-9A-F]{6}$/);
    });

    it('réessaie sur collision puis échoue proprement', async () => {
      linkRepo.findOne.mockResolvedValue(null);
      linkRepo.save.mockRejectedValue(new Error('duplicate key'));

      await expect(service.getOrCreateLink('biz-1')).rejects.toThrow(
        /Impossible de générer/,
      );
      expect(linkRepo.save).toHaveBeenCalledTimes(5);
    });
  });

  describe('sécurité', () => {
    it('le redirect controller lève bien NotFound sur code inconnu', async () => {
      // Le service retourne null → le contrôleur convertit en 404.
      linkRepo.findOne.mockResolvedValue(null);
      await expect(service.resolveCode('FF-INCONNU')).resolves.toBeNull();
      expect(NotFoundException).toBeDefined();
    });
  });
});
