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

      const secret = this.configService.get<string>(
        'JWT_SECRET',
        'SUPER_SECRET_KEY_CHANGEME',
      );
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
      } else if (normalizedRole === 'BUSINESS' && payload.businessId) {
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
      .emit(WsEvents.NEW_ORDER_ALERT, {
        message: '🔔 Nouvelle commande reçue !',
        order,
      });
  }

  dispatchOrderToDrivers(order: Order): void {
    this.server
      .to(WsRooms.AVAILABLE_DRIVERS)
      .emit(WsEvents.DELIVERY_OPPORTUNITY, {
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
        .emit(WsEvents.TARGETED_ORDER_OFFER, payload);
    });
  }

  notifyOrderDisputed(orderId: string, disputeId: string): void {
    if (!this.server) return;
    this.server
      .to(`${WsRooms.ORDER_PREFIX}${orderId}`)
      .emit(WsEvents.ORDER_DISPUTED, {
        orderId,
        disputeId,
        message: 'Un litige a été ouvert sur cette commande.',
      });
  }
}
