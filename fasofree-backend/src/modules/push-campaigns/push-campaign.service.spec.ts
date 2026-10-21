/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { BadRequestException } from '@nestjs/common';
import { PushCampaignService } from './push-campaign.service';
import {
  PushCampaignAudience,
  PushCampaignRecurrence,
  PushCampaignTarget,
} from './entities/push-campaign.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { UserRole as WalletUserRole } from '../wallets/entities/wallet.entity';

/**
 * Tests des campagnes push.
 *
 * Deux classes de régressions historiques y sont verrouillées :
 *  1. `getRoleFilter` référençait `UserRole.RIDER` / `UserRole.MERCHANT`, qui
 *     N'EXISTENT PAS → les cibles DRIVER et MERCHANT cassaient en SQL.
 *  2. La sélection exigeait `fcmToken IS NOT NULL` → « 0 destinataire » alors
 *     que le push FCM est volontairement désactivé (aucun utilisateur n'a de
 *     token).
 *
 * Lot 3 ajoute la facturation auto-service : on vérifie qu'un compte payeur
 * est TOUJOURS débité AVANT diffusion, et qu'une campagne impayée est
 * SUSPENDUE (jamais envoyée gratuitement, jamais retentée chaque minute).
 */

const makeRepo = () => ({
  create: jest.fn((o) => o),
  save: jest.fn(async (o) => ({ id: 'camp-1', ...o })),
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
  // Requêtes BRUTES : `findClientsOfAgency` lit la table `orders` via
  // `userRepo.manager` (même motif que NotificationStoreService).
  manager: {
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    }),
  },
});

describe('PushCampaignService', () => {
  let service: PushCampaignService;
  let campaignRepo: ReturnType<typeof makeRepo>;
  let userRepo: ReturnType<typeof makeRepo>;
  let businessRepo: ReturnType<typeof makeRepo>;
  let agencyRepo: ReturnType<typeof makeRepo>;
  let notificationStore: {
    create: jest.Mock;
    sendToUsers: jest.Mock;
    findClientsOfBusinesses: jest.Mock;
  };
  let walletService: {
    getOrCreateWallet: jest.Mock;
    debitWallet: jest.Mock;
  };
  let configService: { get: jest.Mock };

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

  /** QueryBuilder factice pour une lecture brute (`getRawMany`). */
  const mockRawQuery = (rows: unknown[]) => {
    userRepo.manager.createQueryBuilder = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => rows),
    });
  };

  beforeEach(() => {
    campaignRepo = makeRepo();
    userRepo = makeRepo();
    businessRepo = makeRepo();
    agencyRepo = makeRepo();
    notificationStore = {
      create: jest.fn().mockResolvedValue({}),
      sendToUsers: jest.fn().mockResolvedValue(1),
      findClientsOfBusinesses: jest.fn().mockResolvedValue([]),
    };
    walletService = {
      getOrCreateWallet: jest.fn().mockResolvedValue({}),
      debitWallet: jest
        .fn()
        .mockResolvedValue({ wallet: {}, transaction: { id: 'tx-1' } }),
    };
    configService = { get: jest.fn().mockReturnValue(undefined) };

    service = new PushCampaignService(
      campaignRepo as never,
      userRepo as never,
      notificationStore as never,
      walletService as never,
      configService as never,
      businessRepo as never,
      agencyRepo as never,
    );
  });

  /** Récupère le filtre de rôles via l'accès privé (test de régression). */
  const rolesFor = (target: PushCampaignTarget): UserRole[] | null =>
    (
      service as unknown as {
        getRoleFilter(t: PushCampaignTarget): UserRole[] | null;
      }
    ).getRoleFilter(target);

  /**
   * Appelle une méthode privée EN LA LIANT au service — indispensable, sinon
   * `this` est `undefined` dans la méthode extraite.
   */
  const resolveAudience = (
    audience: PushCampaignAudience,
    ownerUserId: string,
  ) =>
    (
      service as unknown as {
        resolveAudienceUserIds(
          a: PushCampaignAudience,
          u: string,
        ): Promise<{ userIds: string[]; label: string }>;
      }
    ).resolveAudienceUserIds.call(service, audience, ownerUserId);

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
        [
          {
            id: 'u1',
            email: 'client@test.com',
            fullName: 'Client',
            fcmToken: null,
          },
        ],
      ]);

      await service.createCampaign(
        'Promo',
        'Profitez',
        PushCampaignTarget.CLIENT,
        'admin',
      );
      await flush();

      // In-app + push FCM uniquement : la notification est déposée en base même
      // sans token FCM — aucun e-mail n'est envoyé.
      expect(notificationStore.sendToUsers).toHaveBeenCalledTimes(1);
      expect(notificationStore.sendToUsers).toHaveBeenCalledWith(
        ['u1'],
        'Promo',
        'Profitez',
        'PROMOTION',
        '/notifications',
      );
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
      expect(notificationStore.sendToUsers).not.toHaveBeenCalled();
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
      expect(notificationStore.sendToUsers).toHaveBeenCalled();
    });

    it('une campagne ADMIN n’est jamais facturée (aucun débit)', async () => {
      mockUserQuery([[{ id: 'u1', fcmToken: null }]]);

      await service.createCampaign(
        'Promo',
        'Gratuit',
        PushCampaignTarget.CLIENT,
        'admin',
      );
      await flush();

      expect(walletService.debitWallet).not.toHaveBeenCalled();
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

      expect(notificationStore.sendToUsers).toHaveBeenCalled();
      expect(campaignRepo.update).toHaveBeenCalledWith(
        'camp-sched',
        expect.objectContaining({ status: 'SENT' }),
      );
    });

    /**
     * Lot 3 : un compte payeur dont le portefeuille est vide ne doit PAS
     * recevoir de diffusion gratuite. La campagne est suspendue et l'opérateur
     * prévenu — sinon le cron retenterait chaque minute, indéfiniment.
     */
    it('SUSPEND (sans diffuser) une campagne auto-service impayée', async () => {
      walletService.debitWallet.mockRejectedValue(
        new BadRequestException('Solde disponible insuffisant pour ce débit'),
      );
      const due = {
        id: 'camp-paid',
        title: 'Promo',
        body: 'Corps',
        target: PushCampaignTarget.CLIENT,
        status: 'ACTIVE',
        recurrence: PushCampaignRecurrence.DAILY,
        ownerUserId: 'op-1',
        audience: PushCampaignAudience.ALL_CLIENTS,
        runCount: 0,
        billedXof: 0,
      };
      campaignRepo.find = jest.fn().mockResolvedValue([due]);
      mockUserQuery([[{ id: 'u1' }]]);

      await service.sendDueCampaigns();

      expect(notificationStore.sendToUsers).not.toHaveBeenCalled();
      expect(campaignRepo.update).toHaveBeenCalledWith(
        'camp-paid',
        expect.objectContaining({
          status: 'COMPLETED',
          nextRunAt: null,
          failureReason: expect.stringContaining('refusé'),
        }),
      );
      // L'opérateur est prévenu in-app (jamais par e-mail).
      expect(notificationStore.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'op-1' }),
      );
    });

    it('débite PUIS diffuse une campagne auto-service solvable', async () => {
      const due = {
        id: 'camp-paid',
        title: 'Promo',
        body: 'Corps',
        target: PushCampaignTarget.CLIENT,
        status: 'SCHEDULED',
        recurrence: PushCampaignRecurrence.NONE,
        ownerUserId: 'op-1',
        audience: PushCampaignAudience.ALL_CLIENTS,
        runCount: 0,
        billedXof: 0,
      };
      campaignRepo.find = jest.fn().mockResolvedValue([due]);
      mockUserQuery([[{ id: 'u1' }]]);

      await service.sendDueCampaigns();

      expect(walletService.debitWallet).toHaveBeenCalledWith(
        'op-1',
        WalletUserRole.MERCHANT,
        2500,
        'PUSH_CAMPAIGN_FEE',
        expect.any(String),
        expect.any(String),
        undefined,
      );
      expect(notificationStore.sendToUsers).toHaveBeenCalled();
      expect(campaignRepo.update).toHaveBeenCalledWith(
        'camp-paid',
        expect.objectContaining({
          status: 'SENT',
          billedXof: 2500,
          walletTransactionId: 'tx-1',
        }),
      );
    });
  });

  describe('ciblage auto-service (anti-spam)', () => {
    it('refuse OWN_DRIVERS à un marchand', async () => {
      await expect(
        service.createSelfServiceCampaign(
          'op-1',
          UserRole.BUSINESS_ADMIN,
          'Boutique',
          {
            title: 'Promo',
            body: 'Corps',
            audience: PushCampaignAudience.OWN_DRIVERS,
          },
        ),
      ).rejects.toThrow(/non autorisée/);
      expect(campaignRepo.save).not.toHaveBeenCalled();
    });

    it('refuse ALL (toute la base) à une agence', async () => {
      await expect(
        service.createSelfServiceCampaign('op-1', UserRole.AGENCY, 'Agence', {
          title: 'Promo',
          body: 'Corps',
          audience: PushCampaignAudience.ALL,
        }),
      ).rejects.toThrow(/non autorisée/);
    });

    it('refuse ALL (toute la base) à un opérateur auto-service', async () => {
      await expect(
        service.createSelfServiceCampaign(
          'op-1',
          UserRole.BUSINESS_ADMIN,
          'Boutique',
          { title: 'Promo', body: 'Corps', audience: PushCampaignAudience.ALL },
        ),
      ).rejects.toThrow(/non autorisée/);
    });

    it('OWN_CLIENTS ne cible QUE les clients du marchand', async () => {
      businessRepo.find = jest.fn().mockResolvedValue([{ id: 'biz-1' }]);
      notificationStore.findClientsOfBusinesses = jest
        .fn()
        .mockResolvedValue(['c1', 'c2']);

      const res = await resolveAudience(
        PushCampaignAudience.OWN_CLIENTS,
        'op-1',
      );

      expect(notificationStore.findClientsOfBusinesses).toHaveBeenCalledWith([
        'biz-1',
      ]);
      expect(res.userIds).toEqual(['c1', 'c2']);
      // Aucune requête sur la table users : l'audience est strictement
      // limitée aux clients ayant commandé chez ce marchand.
      expect(userRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('OWN_CLIENTS (agence) cible les clients qu’elle a livrés', async () => {
      // Une agence ne possède aucune boutique : sa source de clients est
      // `orders.deliveryProviderId`.
      businessRepo.find = jest.fn().mockResolvedValue([]);
      agencyRepo.findOne = jest
        .fn()
        .mockResolvedValue({ id: 'ag-1', userId: 'op-1' });
      mockRawQuery([{ clientId: 'c1' }, { clientId: 'c2' }]);

      const res = await resolveAudience(
        PushCampaignAudience.OWN_CLIENTS,
        'op-1',
      );

      expect(res.userIds).toEqual(['c1', 'c2']);
    });

    it('OWN_CLIENTS fusionne clients du marchand et clients livrés, sans doublon', async () => {
      businessRepo.find = jest.fn().mockResolvedValue([{ id: 'biz-1' }]);
      notificationStore.findClientsOfBusinesses = jest
        .fn()
        .mockResolvedValue(['c1', 'c2']);
      agencyRepo.findOne = jest
        .fn()
        .mockResolvedValue({ id: 'ag-1', userId: 'op-1' });
      // `c2` est à la fois client du marchand ET livré par l'agence.
      mockRawQuery([{ clientId: 'c2' }, { clientId: 'c3' }]);

      const res = await resolveAudience(
        PushCampaignAudience.OWN_CLIENTS,
        'op-1',
      );

      expect([...res.userIds].sort()).toEqual(['c1', 'c2', 'c3']);
    });

    it('OWN_DRIVERS ne cible QUE les livreurs rattachés à l’agence', async () => {
      agencyRepo.findOne = jest
        .fn()
        .mockResolvedValue({ id: 'ag-1', userId: 'op-1' });
      mockUserQuery([[{ id: 'd1' }, { id: 'd2' }]]);

      const res = await resolveAudience(
        PushCampaignAudience.OWN_DRIVERS,
        'op-1',
      );

      expect(res.userIds).toEqual(['d1', 'd2']);
    });

    it('OWN_DRIVERS sans agence rattachée → aucun destinataire', async () => {
      agencyRepo.findOne = jest.fn().mockResolvedValue(null);

      const res = await resolveAudience(
        PushCampaignAudience.OWN_DRIVERS,
        'op-1',
      );
      expect(res.userIds).toEqual([]);
    });
  });

  describe('campagne auto-service immédiate (facturation)', () => {
    const merchantInput = {
      title: 'Promo',
      body: 'Bonjour',
      audience: PushCampaignAudience.OWN_CLIENTS,
    };

    const ownClients = () => {
      businessRepo.find = jest.fn().mockResolvedValue([{ id: 'biz-1' }]);
      notificationStore.findClientsOfBusinesses = jest
        .fn()
        .mockResolvedValue(['u1', 'u2']);
    };

    it('débite 100 FCFA puis diffuse (jamais l’inverse)', async () => {
      ownClients();
      const calls: string[] = [];
      walletService.debitWallet.mockImplementation(async () => {
        calls.push('debit');
        return { wallet: {}, transaction: { id: 'tx-42' } };
      });
      notificationStore.sendToUsers.mockImplementation(async () => {
        calls.push('send');
        return 2;
      });

      await service.createSelfServiceCampaign(
        'op-1',
        UserRole.BUSINESS_ADMIN,
        'Boutique',
        merchantInput,
      );

      expect(calls).toEqual(['debit', 'send']);
      expect(walletService.debitWallet).toHaveBeenCalledWith(
        'op-1',
        WalletUserRole.MERCHANT,
        100,
        'PUSH_CAMPAIGN_FEE',
        expect.any(String),
        expect.any(String),
        'biz-1',
      );
      expect(campaignRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUserId: 'op-1',
          audience: 'OWN_CLIENTS',
          status: 'SENT',
          billedXof: 100,
          walletTransactionId: 'tx-42',
        }),
      );
    });

    it('ALL_CLIENTS est facturé au tarif « premium » (2500 F), pas 100 F', async () => {
      mockUserQuery([[{ id: 'u1' }, { id: 'u2' }]]);

      await service.createSelfServiceCampaign(
        'op-1',
        UserRole.BUSINESS_ADMIN,
        'Boutique',
        { ...merchantInput, audience: PushCampaignAudience.ALL_CLIENTS },
      );

      const amounts = walletService.debitWallet.mock.calls.map((c) => c[2]);
      expect(amounts).toContain(2500);
      expect(amounts).not.toContain(100);
      expect(campaignRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ audience: 'ALL_CLIENTS', billedXof: 2500 }),
      );
    });

    it('solde insuffisant → 400, AUCUN envoi, aucune campagne fantôme', async () => {
      ownClients();
      walletService.debitWallet.mockRejectedValue(
        new BadRequestException('Solde disponible insuffisant pour ce débit'),
      );

      await expect(
        service.createSelfServiceCampaign(
          'op-1',
          UserRole.BUSINESS_ADMIN,
          'Boutique',
          merchantInput,
        ),
      ).rejects.toThrow(/Paiement de 100 FCFA refusé/);

      expect(notificationStore.sendToUsers).not.toHaveBeenCalled();
      expect(campaignRepo.save).not.toHaveBeenCalled();
    });

    it('audience vide → 400 sans débit (le prix est par envoi)', async () => {
      mockUserQuery([[]]); // ALL_CLIENTS ne renvoie personne

      await expect(
        service.createSelfServiceCampaign(
          'op-1',
          UserRole.BUSINESS_ADMIN,
          'Boutique',
          { ...merchantInput, audience: PushCampaignAudience.ALL_CLIENTS },
        ),
      ).rejects.toThrow(/Aucun destinataire/);

      expect(walletService.debitWallet).not.toHaveBeenCalled();
    });

    it('une récurrence est PLANIFIÉE : aucune facturation à la création', async () => {
      const campaign = await service.createSelfServiceCampaign(
        'op-1',
        UserRole.AGENCY,
        'Agence',
        {
          title: 'Promo',
          body: 'Corps',
          audience: PushCampaignAudience.OWN_DRIVERS,
          recurrence: PushCampaignRecurrence.DAILY,
          timeOfDay: '09:00',
        },
      );

      expect(campaign.status).toBe('ACTIVE');
      expect(campaign.ownerUserId).toBe('op-1');
      expect(campaign.audience).toBe('OWN_DRIVERS');
      expect(campaign.nextRunAt).toBeInstanceOf(Date);
      expect(walletService.debitWallet).not.toHaveBeenCalled();
    });
  });

  describe('facturation (prix unitaire)', () => {
    it('vaut 100 FCFA par défaut', () => {
      expect(service.unitPriceXof).toBe(100);
    });

    it('suit PUSH_CAMPAIGN_UNIT_PRICE_FCFA', () => {
      configService.get = jest.fn().mockReturnValue('250');
      expect(service.unitPriceXof).toBe(250);
    });

    it('retombe sur 100 si la variable est invalide', () => {
      configService.get = jest.fn().mockReturnValue('pas-un-nombre');
      expect(service.unitPriceXof).toBe(100);
    });

    it('grille par audience : ALL_CLIENTS est « premium » (anti-spam)', () => {
      expect(service.priceForAudience(PushCampaignAudience.OWN_CLIENTS)).toBe(
        100,
      );
      expect(service.priceForAudience(PushCampaignAudience.OWN_DRIVERS)).toBe(
        100,
      );
      expect(service.priceForAudience(PushCampaignAudience.ALL_CLIENTS)).toBe(
        2500,
      );
    });

    it('expose la grille complète à l’interface', () => {
      expect(service.pricingTable()).toEqual({
        OWN_CLIENTS: 100,
        OWN_DRIVERS: 100,
        ALL_CLIENTS: 2500,
      });
    });

    it('la grille du dashboard prime sur PUSH_CAMPAIGN_UNIT_PRICE_FCFA', () => {
      configService.get = jest.fn().mockReturnValue('250');
      expect(service.priceForAudience(PushCampaignAudience.ALL_CLIENTS)).toBe(
        2500,
      );
    });
  });

  describe('findAll / findByOwner', () => {
    it('borne la taille de page pour ne pas vider la table', async () => {
      await service.findAll(10);
      expect(campaignRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it('un opérateur ne liste QUE ses campagnes', async () => {
      await service.findByOwner('op-1', 10);
      expect(campaignRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerUserId: 'op-1' }, take: 10 }),
      );
    });

    it('ne peut PAS arrêter la campagne d’un autre', async () => {
      campaignRepo.findOne = jest.fn().mockResolvedValue(null);
      expect(await service.stopOwnedCampaign('camp-1', 'op-2')).toBeNull();
    });
  });
});
