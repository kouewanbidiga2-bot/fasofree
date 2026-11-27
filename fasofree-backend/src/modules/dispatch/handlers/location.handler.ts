/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Server } from 'socket.io';
import { UpdateLocationDto } from '../dto/update-location.dto';
import { GeoDispatchService } from '../../orders/dispatch.service';
import { OrdersService } from '../../orders/orders.service';
import { UsersService } from '../../users/users.service';
import { WsEvents, WsRooms } from '../constants/dispatch-events.enum';

@Injectable()
export class LocationHandler {

  // ⏱️ Throttle de la persistance DB (position du livreur pour le scoring dispatch)
  private readonly lastPersist = new Map<string, number>();
  private static readonly PERSIST_INTERVAL_MS = 5000;

  constructor(
    @Inject(forwardRef(() => GeoDispatchService))
    private readonly dispatchService: GeoDispatchService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  async handleDriverLocationUpdate(
    server: Server,
    driverId: string,
    dto: UpdateLocationDto,
  ) {
    if (!driverId) return { status: 'error', live: false };

    if (dto.orderId) {
      try {
        await this.ordersService.updateDriverLocation(
          dto.orderId, driverId, dto.latitude, dto.longitude, dto.heading,
        );
      } catch {
        return { status: 'error', live: false };
      }
      server.to(`${WsRooms.ORDER_PREFIX}${dto.orderId}`).emit(WsEvents.DRIVER_LOCATION_UPDATED, {
        driverId,
        orderId: dto.orderId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        heading: dto.heading,
        timestamp: new Date().toISOString(),
      });
      return { status: 'ok', live: true };
    }

    // 1. Mise à jour dans Redis Geo via DispatchService (toujours, pour le scoring)
    await this.dispatchService.updateDriverLocation(
      driverId,
      dto.latitude,
      dto.longitude,
    );

    // 2. Persistance throttlée de la position dans l'entité User (scoring DispatchService)
    const now = Date.now();
    const last = this.lastPersist.get(driverId) ?? 0;
    if (now - last >= LocationHandler.PERSIST_INTERVAL_MS) {
      this.lastPersist.set(driverId, now);
      this.usersService
        .updateDriverPosition(driverId, dto.latitude, dto.longitude)
        .catch(() => undefined);
    }

    return { status: 'ok', live: false };
  }
}
