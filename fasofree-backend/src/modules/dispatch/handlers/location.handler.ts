import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Server } from 'socket.io';
import { UpdateLocationDto } from '../dto/update-location.dto';
import { GeoDispatchService } from '../../orders/dispatch.service';
import { OrdersService } from '../../orders/orders.service';
import { OrderStatus } from '../../orders/entities/order.entity';
import { WsEvents, WsRooms } from '../constants/dispatch-events.enum';
import { UsersService } from '../../users/users.service';

@Injectable()
export class LocationHandler {
  private readonly logger = new Logger(LocationHandler.name);

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
    if (!driverId) {
      return { status: 'error', message: 'Utilisateur non identifié.' };
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

    // 2. Suivi live : uniquement si la commande est en cours (IN_TRANSIT = PROCESSING)
    if (dto.orderId) {
      try {
        const order = await this.ordersService.findOne(dto.orderId);

        if (order.status !== OrderStatus.PROCESSING) {
          return {
            status: 'ok',
            live: false,
            reason: `Commande au statut ${order.status} — GPS non diffusé (IN_TRANSIT requis).`,
          };
        }

        // 🗺️ Tracé du parcours
        await this.dispatchService.saveOrderTracePoint(
          dto.orderId,
          dto.latitude,
          dto.longitude,
          dto.heading,
        );

        // 📡 Broadcast en temps réel au client
        server
          .to(`${WsRooms.ORDER_PREFIX}${dto.orderId}`)
          .emit(WsEvents.DRIVER_LOCATION_UPDATED, {
            driverId,
            orderId: dto.orderId,
            latitude: dto.latitude,
            longitude: dto.longitude,
            heading: dto.heading,
            timestamp: new Date().toISOString(),
          });
      } catch (err) {
        this.logger.warn(
          `Commande ${dto.orderId} introuvable — GPS non diffusé: ${err.message}`,
        );
        return { status: 'ok', live: false };
      }
    }

    return { status: 'ok', live: true };
  }
}
