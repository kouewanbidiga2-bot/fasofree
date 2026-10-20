import { BadRequestException } from '@nestjs/common';
import { OnboardingService, Moderator } from './onboarding.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { KycDocumentType, KycStatus } from '../kyc/entities/kyc-document.entity';

/**
 * Tests du flux d'approbation d'une candidature marchand — centre d'intérêt :
 * l'affiche du restaurant (coverImage) fournie par l'admin à l'approbation
 * doit être transmise au business créé (sinon app client = fallback catégorie).
 */
describe('OnboardingService (approve marchand)', () => {
  const moderator: Moderator = {
    userId: 'admin-1',
    role: UserRole.SUPER_ADMIN,
  };

  const makeMerchantUser = (): User =>
    ({
      id: 'user-1',
      fullName: 'Fatou Marchand',
      email: 'fatou@example.com',
      phone: '+22670000001',
      isActive: false,
      applicationType: 'MERCHANT',
      applicationStatus: 'KYC_APPROVED',
      applicationData: {
        businessName: 'Chez Fatou',
        businessCategory: 'RESTAURANT',
        businessAddress: 'Ouaga 2000',
        latitude: 12.37,
        longitude: -1.52,
      },
    }) as unknown as User;

  const makeService = (options?: { kycDocs?: unknown[] }) => {
    const user = makeMerchantUser();

    const userRepository = {
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn().mockImplementation((u: User) => Promise.resolve(u)),
    };

    const businessesService = {
      create: jest.fn().mockResolvedValue({ id: 'biz-1', name: 'Chez Fatou' }),
      findByOwner: jest
        .fn()
        .mockResolvedValue({ id: 'biz-1', name: 'Chez Fatou' }),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const walletService = { getOrCreateWallet: jest.fn().mockResolvedValue({}) };
    const notificationsService = {
      sendApprovalNotification: jest.fn().mockResolvedValue(undefined),
    };
    const emailService = {
      sendWelcomeMerchantEmail: jest.fn().mockResolvedValue(undefined),
    };
    const kycService = {
      mine: jest
        .fn()
        .mockResolvedValue(
          options?.kycDocs ?? [
            { type: KycDocumentType.IDENTITY_CARD, status: KycStatus.APPROVED },
          ],
        ),
    };
    const promotionsService = { create: jest.fn().mockResolvedValue({}) };
    const agenciesService = { create: jest.fn().mockResolvedValue({}) };

    const service = new OnboardingService(
      userRepository as never,
      businessesService as never,
      walletService as never,
      notificationsService as never,
      emailService as never,
      kycService as never,
      promotionsService as never,
      agenciesService as never,
    );

    return { service, userRepository, businessesService };
  };

  it("transmet l'affiche (coverImage) fournie par l'admin au business créé", async () => {
    const { service, businessesService } = makeService();

    await service.approve(
      'user-1',
      moderator,
      '/uploads/covers/chez-fatou.jpg',
    );

    expect(businessesService.create).toHaveBeenCalledTimes(1);
    const [dto, ownerId] = businessesService.create.mock.calls[0];
    expect(dto).toEqual(
      expect.objectContaining({
        name: 'Chez Fatou',
        coverImage: '/uploads/covers/chez-fatou.jpg',
      }),
    );
    expect(ownerId).toBe('user-1');
  });

  it("sans affiche : le business est créé sans coverImage (fallback catégorie côté client)", async () => {
    const { service, businessesService } = makeService();

    await service.approve('user-1', moderator);

    expect(businessesService.create).toHaveBeenCalledTimes(1);
    const dto = businessesService.create.mock.calls[0][0];
    expect(dto).not.toHaveProperty('coverImage');
  });

  it("refuse l'approbation si la CNI n'est pas validée", async () => {
    const { service } = makeService({ kycDocs: [] });

    await expect(service.approve('user-1', moderator)).rejects.toThrow(
      BadRequestException,
    );
  });
});
