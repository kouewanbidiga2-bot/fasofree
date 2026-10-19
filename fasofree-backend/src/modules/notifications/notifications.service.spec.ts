import { NotificationsService } from './notifications.service';
import { NotificationChannel } from '../users/entities/user.entity';

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
  const make = () => {
    const sendToDevice = jest.fn().mockResolvedValue(true);
    const emailService = { sendEmail: jest.fn() };
    const smsService = { sendSms: jest.fn() };
    const whatsappService = {
      sendTextMessage: jest.fn(),
      sendApprovalMessage: jest.fn(),
      sendRejectionMessage: jest.fn(),
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
