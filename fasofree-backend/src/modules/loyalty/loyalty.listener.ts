import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoyaltyService } from './loyalty.service';
import { Order } from '../orders/entities/order.entity';

@Injectable()
export class LoyaltyListener {
  private readonly logger = new Logger(LoyaltyListener.name);

  constructor(private readonly loyaltyService: LoyaltyService) {}

  @OnEvent('order.completed', { async: true })
  async onOrderCompleted(order: Order): Promise<void> {
    try {
      const points = await this.loyaltyService.earnPointsFromOrder(
        order.clientId,
        order.id,
        Number(order.totalAmount),
      );
      if (points > 0) {
        this.logger.log(
          `Loyalty: +${points} points for user ${order.clientId} (order ${order.id})`,
        );
      }
    } catch (err) {
      this.logger.error(`Loyalty: failed to award points for order ${order.id}`, err);
    }
  }
}
