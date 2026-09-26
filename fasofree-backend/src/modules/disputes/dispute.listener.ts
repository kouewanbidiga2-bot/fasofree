import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationStoreService } from '../notifications/notification-store.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { DispatchGateway } from '../dispatch/dispatch.gateway';
import { DISPUTE_OPENED, DISPUTE_RESOLVED } from './events/dispute.events';
import type {
  DisputeOpenedEvent,
  DisputeResolvedEvent,
} from './events/dispute.events';
import { DisputeResolution } from './entities/dispute.entity';

@Injectable()
export class DisputeListener {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly notificationStore: NotificationStoreService,
    private readonly dispatchGateway: DispatchGateway,
  ) {}

  @OnEvent(DISPUTE_OPENED, { async: true })
  async notifyOpened(event: DisputeOpenedEvent): Promise<void> {
    this.dispatchGateway.notifyOrderDisputed(event.orderId, event.disputeId);
    // allSettled : un échec d'un canal ne doit pas faire perdre les autres
    // notifications (pattern notification-store.service).
    await Promise.allSettled([
      // Badge in-app du client (cloche de notifications)
      this.notificationStore.create({
        userId: event.clientId,
        type: NotificationType.DISPUTE,
        title: 'Litige enregistré',
        body: 'Votre demande est en cours de traitement.',
        orderId: event.orderId,
        actionUrl: '/reclamations',
      }),
      this.notifications.sendToTopic(`user-${event.clientId}`, {
        title: 'Litige enregistré',
        body: 'Votre demande est en cours de traitement.',
        data: { disputeId: event.disputeId, orderId: event.orderId },
      }),
      this.notifications.sendToTopic('support-disputes', {
        title: 'Nouveau litige',
        body: `Litige ${event.disputeId} à examiner.`,
        data: { disputeId: event.disputeId, orderId: event.orderId },
      }),
    ]);
  }

  @OnEvent(DISPUTE_RESOLVED, { async: true })
  async notifyResolved(event: DisputeResolvedEvent): Promise<void> {
    await Promise.allSettled([
      // Badge in-app du client (cloche de notifications)
      this.notificationStore.create({
        userId: event.clientId,
        type: NotificationType.DISPUTE,
        title: 'Litige traité',
        body:
          event.resolution === DisputeResolution.REFUND
            ? 'Un remboursement a été approuvé.'
            : 'Votre litige a été rejeté.',
        orderId: event.orderId,
        actionUrl: '/reclamations',
      }),
      this.notifications.sendToTopic(`user-${event.clientId}`, {
        title: 'Litige traité',
        body:
          event.resolution === DisputeResolution.REFUND
            ? 'Un remboursement a été approuvé.'
            : 'Votre litige a été rejeté.',
        data: { disputeId: event.disputeId, orderId: event.orderId },
      }),
    ]);
  }
}
