import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserRole } from './entities/user-role.enum';

/**
 * Régression : « activer » un compte depuis l'onglet Utilisateurs ne doit
 * JAMAIS créer un compte zombie (isActive=true mais login bloqué sur
 * PENDING_APPROVAL / KYC_APPROVED, aucun identifiant envoyé). Seule
 * l'approbation de la candidature (POST /users/applications/:id/approve)
 * peut activer un compte issu d'une candidature.
 */
describe('UsersService.setActiveStatus — garde candidatures non approuvées', () => {
  const make = (target: Record<string, unknown>) => {
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({ ...target }),
      save: jest.fn().mockImplementation((u) => Promise.resolve(u)),
    };
    const businessRepository = {};
    const service = new UsersService(
      userRepository as never,
      businessRepository as never,
    );
    const operator = {
      id: 'op-1',
      email: 'admin@test.fr',
      role: UserRole.ADMIN,
    } as never;
    return { service, userRepository, operator };
  };

  const candidate = (applicationStatus: string | null) => ({
    id: 'u1',
    email: 'candidat@test.fr',
    role: UserRole.DRIVER,
    isActive: false,
    applicationStatus,
  });

  it.each(['PENDING_APPROVAL', 'KYC_APPROVED', 'REJECTED'])(
    "refuse l'activation d'un compte dont la candidature est en %s",
    async (status) => {
      const { service, userRepository, operator } = make(candidate(status));

      await expect(
        service.setActiveStatus(operator, 'u1', true),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(userRepository.save).not.toHaveBeenCalled();
    },
  );

  it('autorise activation quand la candidature est APPROVED', async () => {
    const { service, userRepository, operator } = make(
      candidate('APPROVED'),
    );

    const saved = await service.setActiveStatus(operator, 'u1', true);

    expect(userRepository.save).toHaveBeenCalled();
    expect(saved.isActive).toBe(true);
  });

  it("autorise l'activation d'un compte sans candidature (applicationStatus vide)", async () => {
    const { service, userRepository, operator } = make(candidate(null));

    await service.setActiveStatus(operator, 'u1', true);

    expect(userRepository.save).toHaveBeenCalled();
  });

  it("le bannissement d'un compte KYC approuvé reste possible (réversible)", async () => {
    const { service, userRepository, operator } = make(
      candidate('KYC_APPROVED'),
    );

    await service.setActiveStatus(operator, 'u1', false);

    expect(userRepository.save).toHaveBeenCalled();
  });

  it('un compte ne peut pas activer un autre compte', async () => {
    const { service } = make(candidate('APPROVED'));
    const target = { id: 'u2', role: UserRole.SUPER_ADMIN, email: 'sa@test.fr' };
    (service as unknown as { userRepository: { findOne: jest.Mock } })
      .userRepository.findOne.mockResolvedValue(target);

    await expect(
      service.setActiveStatus(
        { id: 'u1', email: 'autre@test.fr', role: UserRole.ADMIN } as never,
        'u2',
        true,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
