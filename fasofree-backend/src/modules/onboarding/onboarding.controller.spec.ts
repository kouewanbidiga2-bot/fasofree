import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../core/security/roles.guard';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

/**
 * POST /users/applications/:id/approve — couverture du PIPE LOCAL porté par
 * @Body (DefaultValuePipe + ValidationPipe). Point critique : l'app front poste
 * parfois AUCUN corps, et class-validator plante sur `undefined`
 * (TypeError → 500). Le comportement réel du pipe n'est vérifiable qu'ici :
 * le spec du service ne passe pas par les pipes Nest.
 */
describe('OnboardingController — approve (corps optionnel)', () => {
  let app: INestApplication;
  const approve = jest.fn().mockResolvedValue({
    user: { id: 'user-1', fullName: 'Fatou Marchand' },
    tempPassword: 'FF-AABBCCDDEEFF0011',
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [
        {
          provide: OnboardingService,
          useValue: { approve, list: jest.fn(), reject: jest.fn() },
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    // Pas de pipe global ici : on exerce uniquement le pipe local du controller.
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    approve.mockClear();
  });

  it('accepte un POST sans corps (DefaultValuePipe évite le crash de class-validator)', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/applications/user-1/approve')
      .expect(201); // NestJS : 201 Created par défaut sur POST réussi

    expect(res.body.tempPassword).toBe('FF-AABBCCDDEEFF0011');
    expect(approve).toHaveBeenCalledWith(
      'user-1',
      expect.any(Object),
      undefined,
    );
  });

  it('accepte un corps vide {} (front existant avant la couverture coverImage)', async () => {
    await request(app.getHttpServer())
      .post('/users/applications/user-1/approve')
      .send({})
      .expect(201);

    expect(approve).toHaveBeenCalledWith(
      'user-1',
      expect.any(Object),
      undefined,
    );
  });

  it("transmet coverImage fournie dans le corps à l'approbation", async () => {
    await request(app.getHttpServer())
      .post('/users/applications/user-1/approve')
      .send({ coverImage: '/uploads/covers/chez-fatou.jpg' })
      .expect(201);

    expect(approve).toHaveBeenCalledWith(
      'user-1',
      expect.any(Object),
      '/uploads/covers/chez-fatou.jpg',
    );
  });

  it('rejette 400 les champs hors whitelist (cohérent avec le pipe global)', async () => {
    await request(app.getHttpServer())
      .post('/users/applications/user-1/approve')
      .send({ champInconnu: 'x' })
      .expect(400);

    expect(approve).not.toHaveBeenCalled();
  });
});
