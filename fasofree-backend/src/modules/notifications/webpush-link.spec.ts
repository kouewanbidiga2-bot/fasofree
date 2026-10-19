import { getMessaging } from 'firebase-admin/messaging';

import { NotificationsService } from './notifications.service';

/**
 * Régression FCM : `webpush.fcmOptions.link` doit être une URL ABSOLUE en
 * HTTPS — doc officielle (FCM REST v1, WebpushFcmOptions) :
 * « For all URL values, HTTPS is required ».
 *
 * On envoyait auparavant un lien RELATIF ("/", "/order-tracking?id=…") :
 * valeur interdite, le push web était rejeté/neutralisé par FCM alors que
 * tout le reste (token, permission, SW) était conforme.
 */
jest.mock('firebase-admin/messaging', () => ({ getMessaging: jest.fn() }));
jest.mock('firebase-admin/app', () => ({ getApps: jest.fn(() => [{}]) }));

describe('NotificationsService — lien webpush ABSOLU (HTTPS exigé par FCM)', () => {
  const make = (clientUrl?: string) => {
    const send = jest.fn().mockResolvedValue('message-id');
    (getMessaging as jest.Mock).mockReturnValue({ send });
    const configService = { get: jest.fn().mockReturnValue(clientUrl) };
    const service = new NotificationsService(
      {} as never,
      {} as never,
      {} as never,
      { clearFcmToken: jest.fn() } as never,
      configService as never,
    );
    return { service, send, configService };
  };

  it('sans CLIENT_URL → lien absolu sur le domaine client canonique', async () => {
    const { service, send, configService } = make(undefined);

    await service.sendToDevice('tok', { title: 'T', body: 'B' });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].webpush.fcmOptions.link).toBe(
      'https://www.fasofree.site/',
    );
    expect(configService.get).toHaveBeenCalledWith('CLIENT_URL');
  });

  it('orderId → lien absolu vers /order-tracking (slash final de CLIENT_URL neutralisé)', async () => {
    const { service, send } = make('https://fasofree.site/');

    await service.sendToDevice('tok', {
      title: 'T',
      body: 'B',
      data: { orderId: 'o-42' },
    });

    expect(send.mock.calls[0][0].webpush.fcmOptions.link).toBe(
      'https://fasofree.site/order-tracking?id=o-42',
    );
  });

  it('le lien ne commence JAMAIS par "/" (relatif = refusé par FCM)', async () => {
    const { service, send } = make(undefined);

    await service.sendToDevice('tok', {
      title: 'T',
      body: 'B',
      data: { orderId: 'o-1' },
    });

    expect(send.mock.calls[0][0].webpush.fcmOptions.link).toMatch(
      /^https:\/\/\S+$/,
    );
  });
});
