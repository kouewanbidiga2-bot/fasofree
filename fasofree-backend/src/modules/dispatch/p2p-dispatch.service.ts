import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, In } from 'typeorm';
import { GeoDispatchService } from '../orders/dispatch.service';
import { Order, OrderStatus, OrderType } from '../orders/entities/order.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { User } from '../users/entities/user.entity';
import { DispatchGateway } from './dispatch.gateway';
import {
  ACTIVE_DELIVERY_STATUSES, deliveryDistanceKm, isCompatibleDeliveryZone,
  isOpenP2pOrder, MAX_ACTIVE_DELIVERIES_PER_DRIVER,
  P2P_GPS_MAX_AGE_MS, P2P_OFFER_DURATION_MS, P2P_WAVE_RADII_KM,
} from './delivery-rules';

@Injectable()
export class P2pDispatchService {
  private readonly logger = new Logger(P2pDispatchService.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly geo: GeoDispatchService,
    private readonly gateway: DispatchGateway,
  ) {}

  @Cron('*/5 * * * * *')
  async dispatchDueOrders(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.dataSource.getRepository(Order).createQueryBuilder('o')
        .select(['o.id'])
        .where('o.orderType = :type AND o.status IN (:...statuses)', {
          type: OrderType.P2P_DELIVERY,
          statuses: [OrderStatus.PAID, OrderStatus.READY_FOR_PICKUP],
        })
        .andWhere('o."driverId" IS NULL AND o."deliveryProviderId" IS NULL')
        .andWhere('o."nextP2pDispatchAt" <= :now', { now: new Date() })
        .orderBy('o."nextP2pDispatchAt"', 'ASC')
        .take(25).getMany();
      for (const { id } of due) {
        try {
          const offer = await this.advance(id);
          if (offer) await this.deliverOffer(id, offer.driverIds, offer.expiresAt);
        } catch {
          this.logger.warn(`La vague de recherche du colis ${id} sera réessayée.`);
        }
      }
    } catch {
      this.logger.warn('Recherche de coursiers colis temporairement indisponible.');
    } finally {
      this.running = false;
    }
  }

  private async advance(id: string) {
    return this.dataSource.transaction(async manager => {
      const orders = manager.getRepository(Order);
      const order = await orders.createQueryBuilder('o')
        .where('o.id = :id', { id }).setLock('pessimistic_write').setOnLocked('skip_locked').getOne();
      if (!order || !isOpenP2pOrder(order) || !order.nextP2pDispatchAt
        || order.nextP2pDispatchAt.getTime() > Date.now()) return null;

      const pickup = order.pickupLocation;
      const target = order.dropoffLocation ?? order.deliveryLocation;
      const previous = order.dispatchCandidates ?? [];
      if (!pickup || deliveryDistanceKm(pickup, target) == null) {
        await orders.update(id, { p2pDispatchWave: P2P_WAVE_RADII_KM.length, nextP2pDispatchAt: null });
        return null;
      }
      if (order.p2pDispatchWave >= P2P_WAVE_RADII_KM.length) {
        await orders.update(id, { nextP2pDispatchAt: null });
        return null;
      }

      // Une seule lecture Redis pour tous les rayons. Aucun GPS périmé ne peut
      // ouvrir une attente de 25 s ou provoquer un envoi.
      const nearby = (await this.geo.findNearbyActiveDrivers(
        pickup.latitude, pickup.longitude,
        P2P_WAVE_RADII_KM[P2P_WAVE_RADII_KM.length - 1], 100, P2P_GPS_MAX_AGE_MS,
      )).filter(entry => !previous.some(offer => offer.driverId === entry.driverId));
      const userIds = nearby.map(entry => entry.driverId);
      const drivers = userIds.length ? await manager.getRepository(User).find({
        where: { id: In(userIds), role: In([UserRole.DRIVER, UserRole.COURIER]), isActive: true, isOnline: true, isAvailable: true },
        select: { id: true },
      }) : [];
      const driverIds = drivers.map(driver => driver.id);
      const active = driverIds.length ? await orders.find({
        where: { driverId: In(driverIds), status: In([...ACTIVE_DELIVERY_STATUSES]) },
        select: { id: true, driverId: true, pickupLocation: true, dropoffLocation: true, deliveryLocation: true },
      }) : [];
      const eligible = nearby.filter(entry => {
        if (!driverIds.includes(entry.driverId)) return false;
        const missions = active.filter(item => item.driverId === entry.driverId);
        return missions.length < MAX_ACTIVE_DELIVERIES_PER_DRIVER && isCompatibleDeliveryZone(order, missions);
      });
      const wave = P2P_WAVE_RADII_KM.findIndex(
        (radius, index) => index >= order.p2pDispatchWave && eligible.some(entry => entry.distanceKm <= radius),
      );
      if (wave < 0) {
        await orders.update(id, { p2pDispatchWave: P2P_WAVE_RADII_KM.length, nextP2pDispatchAt: null });
        return null;
      }
      const invited = eligible.filter(entry => entry.distanceKm <= P2P_WAVE_RADII_KM[wave]).slice(0, 8);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + P2P_OFFER_DURATION_MS);
      await orders.update(id, {
        dispatchCandidates: [...previous, ...invited.map(entry => ({
          driverId: entry.driverId, notifiedAt: now, offerExpiresAt: expiresAt.toISOString(),
          pickupDistanceKm: Math.round(entry.distanceKm * 10) / 10,
        }))],
        dispatchedAt: order.dispatchedAt ?? now,
        p2pDispatchWave: wave + 1,
        nextP2pDispatchAt: expiresAt,
      });
      return { driverIds: invited.map(entry => entry.driverId), expiresAt };
    });
  }

  private async deliverOffer(id: string, driverIds: string[], expiresAt: Date): Promise<void> {
    // L’offre est lisible avant la publication. Le verrou empêche un envoi
    // concurrent après l’acceptation ou l’annulation.
    await this.dataSource.transaction(async manager => {
      const order = await manager.findOne(Order, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!order || !isOpenP2pOrder(order) || expiresAt.getTime() <= Date.now()) return;
      const invited = order.dispatchCandidates?.filter(candidate => driverIds.includes(candidate.driverId)
        && !candidate.refused && candidate.offerExpiresAt === expiresAt.toISOString()) ?? [];
      for (const candidate of invited) {
        this.gateway.notifyCandidateDrivers([candidate.driverId], {
          orderId: order.id,
          expiresAt: candidate.offerExpiresAt,
        });
      }
    });
  }
}
