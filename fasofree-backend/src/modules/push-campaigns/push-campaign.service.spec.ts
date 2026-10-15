import { PushCampaignService } from './push-campaign.service';
import { PushCampaignTarget } from './entities/push-campaign.entity';
import { UserRole } from '../users/entities/user-role.enum';

/**
 * Tests des campagnes push.
 *
 * Le point critique Historically cassé : `getRoleFilter` référençait
 * `UserRole.RIDER` et `UserRole.MERCHANT`, qui N'EXISTENT PAS dans l'enum.
 * Résultat : les campagnes DRIVER et MERCHANT sélectionnaient `undefined`
 * et cassaient sur une erreur SQL au runtime.
 */

const makeRepo = () => ({
  create: jest.fn((o) => o),
  save: jest.fn(async (o) => ({ id: 'camp-1', ...o })),
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('PushCampaignService', () => {
  let service: PushCampaignService;
  let campaignRepo: ReturnType<typeof makeRepo>;
  let userRepo: ReturnType<typeof makeRepo>;
  let notifications: { sendToDevice: jest.Mock; sendNotification: jest.Mock };

  /** Exécute une promesse et laisse passer les rejets (fire-and-forget). */
  const flush = () => new Promise((r) => setImmediate(r));

  /** QueryBuilder factice servant `rows` par lots. */
  const mockUserQuery = (batches: unknown[][]) => {
    let call = 0;
    userRepo.createQueryBuilder = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => batches[call++] ?? []),
    });
  };

  beforeEach(() => {
    campaignRepo = makeRepo();
    userRepo = makeRepo();
    notifications = {
      sendToDevice: jest.fn().mockResolvedValue(true),
      sendNotification: jest.fn().mockResolvedValue(true),
    };

    service = new PushCampaignService(
      campaignRepo as never,
      userRepo as never,
      notifications as never,
    );
  });

  /** Récupère le filtre de rôles via l'accès privé (test de régression). */
  const rolesFor = (target: PushCampaignTarget): UserRole[] | null =>
    (
      service as unknown as {
        getRoleFilter(t: PushCampaignTarget): UserRole[] | null;
      }
    ).getRoleFilter(target);

  describe('mapping des cibles → rôles réels', () => {
    it('CLIENT cible exactement le rôle CLIENT', () => {
      expect(rolesFor(PushCampaignTarget.CLIENT)).toEqual([UserRole.CLIENT]);
    });

    it('DRIVER mappe sur COURIER + DRIVER (pas de RIDER inexistant)', () => {
      const roles = rolesFor(PushCampaignTarget.DRIVER);
      expect(roles).toEqual([UserRole.COURIER, UserRole.DRIVER]);
      expect(roles).not.toContain(undefined);
    });

    it('MERCHANT mappe sur BUSINESS_ADMIN (pas de MERCHANT inexistant)', () => {
      const roles = rolesFor(PushCampaignTarget.MERCHANT);
      expect(roles).toEqual([UserRole.BUSINESS_ADMIN]);
      expect(roles).not.toContain(undefined);
    });

    it('ALL ne filtre pas les rôles', () => {
      expect(rolesFor(PushCampaignTarget.ALL)).toBeNull();
    });

    it('aucun rôle retourné n’est undefined (bug runtime SQL)', () => {
      for (const target of Object.values(PushCampaignTarget)) {
        const roles = rolesFor(target);
        if (roles === null) continue;
        expect(roles.every((r) => typeof r === 'string' && r.length > 0)).toBe(
          true,
        );
      }
    });

    it('toutes les cibles correspondent à des valeurs de l’enum UserRole', () => {
      const valid = new Set<string>(Object.values(UserRole));
      for (const target of Object.values(PushCampaignTarget)) {
        for (const role of rolesFor(target) ?? []) {
          expect(valid.has(role)).toBe(true);
        }
      }
    });
  });

  describe('createCampaign', () => {
    it('crée la campagne puis lance l’envoi en arrière-plan', async () => {
      const campaign = await service.createCampaign(
        'Titre',
        'Corps',
        PushCampaignTarget.CLIENT,
        'Admin Test',
      );

      expect(campaign).toMatchObject({
        title: 'Titre',
        target: PushCampaignTarget.CLIENT,
        sentBy: 'Admin Test',
        recipientCount: 0,
      });
      expect(campaignRepo.save).toHaveBeenCalled();
    });

    it('nEchoie pas une erreur d’envoi à l’appelant HTTP', async () => {
      userRepo.createQueryBuilder = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockRejectedValue(new Error('DB down')),
      });

      // Ne doit pas rejeter.
      await expect(
        service.createCampaign('T', 'B', PushCampaignTarget.ALL, 'admin'),
      ).resolves.toBeDefined();

      await flush(); // laisse le rejet se produire en arrière-plan
    });

    /**
     * Régression : la sélection exigeait `fcmToken IS NOT NULL`. Or le FCM
     * n'est alimenté que par l'app mobile — un client inscrit depuis le web
     * n'a aucun token, d'où « 0 destinataire » sur une cible CLIENT valide.
     */
    it('contacte un client inscribed SANS token FCM (bug « 0 destinataire »)', async () => {
      mockUserQuery([
        [{ id: 'u1', email: 'client@test.com', fullName: 'Client', fcmToken: null }],
      ]);

      await service.createCampaign('Promo', 'Profitez', PushCampaignTarget.CLIENT, 'admin');
      await flush();

      expect(notifications.sendNotification).toHaveBeenCalledTimes(1);
      expect(notifications.sendToDevice).not.toHaveBeenCalled();
      expect(campaignRepo.update).toHaveBeenCalledWith(
        'camp-1',
        expect.objectContaining({ targetedCount: 1 }),
      );
      expect(campaignRepo.update).toHaveBeenCalledWith(
        'camp-1',
        expect.objectContaining({ recipientCount: 1 }),
      );
    });

    it('programme la campagne et ne l’envoie pas tout de suite', async () => {
      const when = new Date(Date.now() + 60 * 60 * 1000);

      const campaign = await service.createCampaign(
        'Promo',
        'Demain',
        PushCampaignTarget.CLIENT,
        'admin',
        when,
      );

      expect(campaign.status).toBe('SCHEDULED');
      expect(notifications.sendNotification).not.toHaveBeenCalled();
    });

    it('envoie immédiatement si la date programmée est déjà passée', async () => {
      mockUserQuery([
        [{ id: 'u1', email: 'c@t.com', fullName: 'C', fcmToken: null }],
      ]);

      const campaign = await service.createCampaign(
        'Promo',
        'Oubliée',
        PushCampaignTarget.CLIENT,
        'admin',
        new Date(Date.now() - 60_000),
      );

      expect(campaign.status).toBe('SENT');
      await flush();
      expect(notifications.sendNotification).toHaveBeenCalled();
    });
  });

  describe('sendDueCampaigns (cron)', () => {
    it('diffuse les campagnes programmées échues', async () => {
      const due = {
        id: 'camp-sched',
        title: 'Promo',
        body: 'Corps',
        target: PushCampaignTarget.CLIENT,
        status: 'SCHEDULED',
      };
      campaignRepo.find = jest.fn().mockResolvedValue([due]);
      mockUserQuery([
        [{ id: 'u1', email: 'c@t.com', fullName: 'C', fcmToken: null }],
      ]);

      await service.sendDueCampaigns();

      expect(notifications.sendNotification).toHaveBeenCalled();
      expect(campaignRepo.update).toHaveBeenCalledWith(
        'camp-sched',
        expect.objectContaining({ status: 'SENT' }),
      );
    });
  });

  describe('findAll', () => {
    it('borne la taille de page pour ne pas vider la table', async () => {
      await service.findAll(10);
      expect(campaignRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });
});
