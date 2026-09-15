import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { UpdateLocationDto } from './dto/update-location.dto';
import { JoinBusinessRoomDto, JoinOrderTrackingDto } from './dto/room.dto';
import { WsEvents, WsRooms } from './constants/dispatch-events.enum';
import { LocationHandler } from './handlers/location.handler';
import { RoomHandler } from './handlers/room.handler';
import { Order } from '../orders/entities/order.entity';
import { resolveJwtSecret } from '../../config/jwt.config';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/dispatch',
})
@UsePipes(new ValidationPipe({ transform: true }))
export class DispatchGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DispatchGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly locationHandler: LocationHandler,
    private readonly roomHandler: RoomHandler,
  ) {}

  /**
   * 🔒 1. Auth & Rooms Setup
   */
  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.headers.authorization?.split(' ')[1] ||
        (client.handshake.query.token as string) ||
        (client.handshake.auth?.token as string);

      if (!token) {
        this.logger.warn(
          `[WS Auth Failed] Connexion rejetée (Token absent) : ${client.id}`,
        );
        client.disconnect();
        return;
      }

      const secret = resolveJwtSecret(this.configService);
      const payload = this.jwtService.verify(token, { secret });

      client.data.user = payload;
      const userId = payload.sub;
      const role = payload.role;

      this.logger.log(
        `[WS Authenticated] Socket: ${client.id} | User: ${userId} | Role: ${role}`,
      );

      const normalizedRole = String(role).toUpperCase();
      if (normalizedRole === 'DRIVER' || normalizedRole === 'COURIER') {
        client.join(WsRooms.AVAILABLE_DRIVERS);
        client.join(`${WsRooms.DRIVER_PREFIX}${userId}`);
      } else if (
        (normalizedRole.includes('BUSINESS') || normalizedRole === 'MERCHANT' || normalizedRole === 'RESTAURANT') &&
        payload.businessId
      ) {
        client.join(`${WsRooms.BUSINESS_PREFIX}${payload.businessId}`);
      }
    } catch (error) {
      this.logger.error(
        `[WS Auth Error] Socket ${client.id} : ${error.message}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.user?.sub || 'Inconnu';
    this.logger.log(`[WS Disconnected] Socket: ${client.id} | User: ${userId}`);
  }

  /**
   * 📩 SUBSCRIPTIONS (Déléguées aux Handlers)
   */
  @SubscribeMessage(WsEvents.JOIN_BUSINESS_ROOM)
  handleJoinBusiness(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinBusinessRoomDto,
  ) {
    return this.roomHandler.handleJoinBusinessRoom(client, dto.businessId);
  }

  @SubscribeMessage(WsEvents.JOIN_ORDER_TRACKING)
  handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinOrderTrackingDto,
  ) {
    return this.roomHandler.handleJoinOrderTracking(client, dto.orderId);
  }

  @SubscribeMessage(WsEvents.UPDATE_DRIVER_LOCATION)
  async handleUpdateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: UpdateLocationDto,
  ) {
    const driverId = client.data.user?.sub;
    return this.locationHandler.handleDriverLocationUpdate(
      this.server,
      driverId,
      dto,
    );
  }

  /**
   * 📢 BROADCASTS (Méthodes publiques appelées par d'autres services)
   */
  notifyNewOrderToBusiness(businessId: string, order: Order): void {
    this.server
      .to(`${WsRooms.BUSINESS_PREFIX}${businessId}`)
      .emit('newOrderAlert', {
        message: '🔔 Nouvelle commande reçue !',
        order,
      });
  }

  dispatchOrderToDrivers(order: Order): void {
    this.server
      .to(WsRooms.AVAILABLE_DRIVERS)
      .emit('delivery_opportunity', {
        message: '🛵 Nouvelle livraison disponible !',
        orderId: order.id,
        orderType: order.orderType,
        earningXOF: order.deliveryFee,
        totalAmount: order.totalAmount,
        pickupAddress: order.pickupLocation?.address ?? null,
        pickupLatitude: order.pickupLocation?.latitude ?? null,
        pickupLongitude: order.pickupLocation?.longitude ?? null,
        dropoffAddress: order.dropoffLocation?.address ?? null,
        dropoffLatitude: order.deliveryLocation?.latitude ?? null,
        dropoffLongitude: order.deliveryLocation?.longitude ?? null,
      });
  }

  notifyCandidateDrivers(
    driverIds: string[],
    payload: Record<string, any>,
  ): void {
    driverIds.forEach((driverId) => {
      this.server
        .to(`${WsRooms.DRIVER_PREFIX}${driverId}`)
        .emit('targeted_order_offer', payload);
    });
  }

  notifyOrderDisputed(orderId: string, disputeId: string): void {
    if (!this.server) return;
    this.server
      .to(`${WsRooms.ORDER_PREFIX}${orderId}`)
      .emit('orderDisputed', {
        orderId,
        disputeId,
        message: 'Un litige a été ouvert sur cette commande.',
      });
  }

  /**
   * 📢 7. Diffuser un changement de statut de commande à toutes les parties prenantes.
   * Le livreur, le marchand et les admins connectés reçoivent l'événement en temps réel.
   */
  broadcastOrderStatusChanged(
    order: { id: string; status: string; driverId?: string | null; businessId?: string | null },
  ): void {
    if (!this.server) return;

    // 1. Notifier la room de la commande (client, livreur, marchand qui trackent)
    this.server
      .to(`${WsRooms.ORDER_PREFIX}${order.id}`)
      .emit('orderStatusChanged', {
        orderId: order.id,
        status: order.status,
      });

    // 2. Notifier le livreur assigné (pour qu'il voie le changement sans reconnexion)
    if (order.driverId) {
      this.server
        .to(`${WsRooms.DRIVER_PREFIX}${order.driverId}`)
        .emit('orderStatusChanged', {
          orderId: order.id,
          status: order.status,
        });
    }

    // 3. Notifier le business concerné
    if (order.businessId) {
      this.server
        .to(`${WsRooms.BUSINESS_PREFIX}${order.businessId}`)
        .emit('orderStatusChanged', {
          orderId: order.id,
          status: order.status,
        });
    }

    // 4. Notifier tous les livreurs en ligne (pour les commandes disponibles)
    if (order.status === 'READY_FOR_PICKUP') {
      this.server
        .to(WsRooms.AVAILABLE_DRIVERS)
        .emit('delivery_opportunity', {
          orderId: order.id,
          message: 'Nouvelle livraison disponible',
        });
    }

    this.logger.log(
      `[WS Broadcast] orderStatusChanged → commande #${order.id} (${order.status})`,
    );
  }
}
