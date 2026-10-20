import { NotificationsService } from './notifications.service';
import { NotificationChannel } from '../users/entities/user.entity';

const make = () => {
  const sendToDevice = jest.fn().mockResolvedValue(true);
  const emailService = {
    sendEmail: jest.fn(),
    sendApprovalEmail: jest.fn().mockResolvedValue(true),
    sendRejectionEmail: jest.fn().mockResolvedValue(true),
  };
  const smsService = { sendSms: jest.fn().mockResolvedValue(true) };
  const whatsappService = {
    sendTextMessage: jest.fn(),
    sendApprovalMessage: jest.fn().mockResolvedValue(true),
    sendRejectionMessage: jest.fn().mockResolvedValue(true),
  };
  const usersService = { clearFcmToken: jest.fn() };
  // ConfigService : sert uniquement à construire le lien webpush (CLIENT_URL).
  const configService = { get: jest.fn().mockReturnValue(undefined) };

  const service = new NotificationsService(
    smsService as never,
    emailService as never,
    whatsappService as never,
    usersService as never,
    configService as never,
  );
  // sendToDevice dépend de Firebase Admin : on l'observationne.
  (service as unknown as { sendToDevice: jest.Mock }).sendToDevice =
    sendToDevice;

  return { service, sendToDevice, emailService, smsService, whatsappService };
};

/**
 * Régression : les notifications du flux in-app ne doivent JAMAIS partir par
 * e-mail / SMS / WhatsApp. Elles sont déposées en base (cloche) et poussées
 * via FCM uniquement — comme les notifications YouTube / WhatsApp.
 *
 * Historiquement, `sendNotification()` choisissait le canal préféré
 * (EMAIL par défaut) : chaque notification déclenchait un e-mail. Ce test
 * verrouille le nouveau comportement.
 */
describe('NotificationsService — pas d’e-mail pour les notifications', () => {
  it('sendPushNotification pousse le FCM sans AUCUN e-mail/SMS/WhatsApp', async () => {
    const { service, sendToDevice, emailService, smsService, whatsappService } =
      make();
    const user = {
      id: 'u1',
      email: 'client@test.fr',
      phone: '+22600000000',
      fcmToken: 'token-fcm',
      // Même avec un canal préféré EMAIL, aucune e-mail ne doit partir.
      preferredNotificationChannel: NotificationChannel.EMAIL,
    } as never;

    await service.sendPushNotification(user, 'Titre', 'Corps');

    expect(sendToDevice).toHaveBeenCalledTimes(1);
    expect(sendToDevice).toHaveBeenCalledWith('token-fcm', {
      title: 'Titre',
      body: 'Corps',
      data: undefined,
    });
    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(smsService.sendSms).not.toHaveBeenCalled();
    expect(whatsappService.sendTextMessage).not.toHaveBeenCalled();
  });

  it('sans token FCM, aucun repli e-mail (retour false)', async () => {
    const { service, sendToDevice, emailService, smsService } = make();
    const user = {
      id: 'u1',
      email: 'client@test.fr',
      phone: '+22600000000',
      fcmToken: null,
      preferredNotificationChannel: NotificationChannel.EMAIL,
    } as never;

    await expect(service.sendPushNotification(user, 'T', 'C')).resolves.toBe(
      false,
    );

    expect(sendToDevice).not.toHaveBeenCalled();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(smsService.sendSms).not.toHaveBeenCalled();
  });
});

/**
 * Régression : les IDENTIFIANTS d'approbation / le refus de candidature sont
 * transactionnels — jamais perdus silencieusement. Si le canal préféré échoue
 * (WhatsApp non configuré, e-mail en échec, numéro absent), on replie sur le
 * SMS puis l'e-mail. Verrouille aussi le cas du livreur qui avait choisi
 * WhatsApp : e-mail garanti + WhatsApp, sinon SMS avec le mot de passe.
 */
describe('NotificationsService — approbation/refus : canal préféré + replis', () => {
  const driverOver = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'd1',
      fullName: 'Kouassi Livreur',
      email: 'livreur@test.fr',
      phone: '+22607000001',
      fcmToken: null,
      applicationType: 'DRIVER',
      preferredNotificationChannel: NotificationChannel.WHATSAPP,
      ...overrides,
    }) as never;

  it('livreur WhatsApp : e-mail garanti + WhatsApp, pas de SMS', async () => {
    const { service, emailService, smsService, whatsappService } = make();

    await service.sendApprovalNotification(driverOver(), 'FF-abc123');

    expect(emailService.sendApprovalEmail).toHaveBeenCalledWith(
      'livreur@test.fr',
      'Kouassi Livreur',
      'DRIVER',
      'FF-abc123',
    );
    expect(whatsappService.sendApprovalMessage).toHaveBeenCalledWith(
      '+22607000001',
      'Kouassi Livreur',
      'DRIVER',
      'FF-abc123',
      'livreur@test.fr',
    );
    expect(smsService.sendSms).not.toHaveBeenCalled();
  });

  it('WhatsApp échoue (non configuré) → repli SMS avec le mot de passe', async () => {
    const { service, smsService, whatsappService } = make();
    whatsappService.sendApprovalMessage.mockResolvedValue(false);

    await service.sendApprovalNotification(driverOver(), 'FF-abc123');

    expect(smsService.sendSms).toHaveBeenCalledTimes(1);
    expect(smsService.sendSms).toHaveBeenCalledWith(
      '+22607000001',
      expect.stringContaining('FF-abc123'),
    );
  });

  it('canal EMAIL en échec → repli SMS avec le mot de passe', async () => {
    const { service, emailService, smsService } = make();
    emailService.sendApprovalEmail.mockResolvedValue(false);

    await service.sendApprovalNotification(
      driverOver({ preferredNotificationChannel: NotificationChannel.EMAIL }),
      'FF-abc123',
    );

    expect(smsService.sendSms).toHaveBeenCalledTimes(1);
    expect(smsService.sendSms).toHaveBeenCalledWith(
      '+22607000001',
      expect.stringContaining('FF-abc123'),
    );
  });

  it('échec WhatsApp puis échec SMS → dernier repli e-mail transactionnel', async () => {
    const { service, emailService, smsService, whatsappService } = make();
    whatsappService.sendApprovalMessage.mockResolvedValue(false);
    smsService.sendSms.mockResolvedValue(false);

    await service.sendApprovalNotification(driverOver(), 'FF-abc123');

    // 1er envoi (garanti livreur) + repli e-mail = 2 appels.
    expect(emailService.sendApprovalEmail).toHaveBeenCalledTimes(2);
  });

  it('marchand : pas de doublon e-mail approbation (bienvenue envoyée par onboarding)', async () => {
    const { service, emailService } = make();

    await service.sendApprovalNotification(
      driverOver({ applicationType: 'MERCHANT', email: 'marchand@test.fr' }),
      '123456',
    );

    expect(emailService.sendApprovalEmail).not.toHaveBeenCalled();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('refus WhatsApp échoue, sans téléphone → repli e-mail de refus', async () => {
    const { service, emailService, whatsappService } = make();
    whatsappService.sendRejectionMessage.mockResolvedValue(false);

    await service.sendRejectionNotification(
      driverOver({ phone: null }),
      'Pièce illisible',
    );

    expect(emailService.sendRejectionEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendRejectionEmail).toHaveBeenCalledWith(
      'livreur@test.fr',
      'Kouassi Livreur',
      'DRIVER',
      'Pièce illisible',
    );
  });
});
