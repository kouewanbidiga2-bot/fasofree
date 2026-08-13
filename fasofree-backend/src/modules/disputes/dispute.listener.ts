import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications/notifications.service';
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
    private readonly dispatchGateway: DispatchGateway,
  ) {}

  @OnEvent(DISPUTE_OPENED, { async: true })
  async notifyOpened(event: DisputeOpenedEvent): Promise<void> {
    this.dispatchGateway.notifyOrderDisputed(event.orderId, event.disputeId);
    await Promise.all([
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
    await this.notifications.sendToTopic(`user-${event.clientId}`, {
      title: 'Litige traité',
      body:
        event.resolution === DisputeResolution.REFUND
          ? 'Un remboursement a été approuvé.'
          : 'Votre litige a été rejeté.',
      data: { disputeId: event.disputeId, orderId: event.orderId },
    });
  }
}
