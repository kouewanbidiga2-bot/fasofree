import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Server } from 'socket.io';
import { UpdateLocationDto } from '../dto/update-location.dto';
import { DispatchService } from '../../orders/dispatch.service';
import { WsEvents, WsRooms } from '../constants/dispatch-events.enum';

@Injectable()
export class LocationHandler {
  private readonly logger = new Logger(LocationHandler.name);

  constructor(
    @Inject(forwardRef(() => DispatchService))
    private readonly dispatchService: DispatchService,
  ) {}

  async handleDriverLocationUpdate(
    server: Server,
    driverId: string,
    dto: UpdateLocationDto,
  ) {
    if (!driverId) {
      return { status: 'error', message: 'Utilisateur non identifié.' };
    }

    // 1. Mise à jour dans Redis Geo via DispatchService
    await this.dispatchService.updateDriverLocation(
      driverId,
      dto.latitude,
      dto.longitude,
    );

    // 2. Broadcast si le livreur est en cours de livraison
    if (dto.orderId) {
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
    }

    return { status: 'ok' };
  }
}
