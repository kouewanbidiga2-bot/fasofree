import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Injectable, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UpdateLocationDto } from './dto/update-location.dto';
import { JoinBusinessRoomDto, JoinOrderTrackingDto } from './dto/room.dto';
import { WsEvents, WsRooms } from './constants/dispatch-events.enum';
import { LocationHandler } from './handlers/location.handler';
import { RoomHandler } from './handlers/room.handler';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Business } from '../businesses/entities/business.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { resolveJwtSecret } from '../../config/jwt.config';

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      const isProduction = process.env.NODE_ENV === 'production';
      if (!origin || !isProduction) {
        callback(null, true);
      } else {
        const allowedPatterns = [
          /\.fasofree\.site$/,
          /\.vercel\.app$/,
          /\.onrender\.com$/,
        ];
        if (allowedPatterns.some((re) => re.test(origin))) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
  },
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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
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
        normalizedRole.includes('BUSINESS') || normalizedRole === 'MERCHANT' || normalizedRole === 'RESTAURANT'
      ) {
        // Rejoindre la room de toutes les agences du marchand
        let businessIds: string[] = [];
        if (payload.businessId) {
          businessIds.push(payload.businessId);
        }
        // Fallback: reconstruire businessId depuis la DB si absent du JWT
        if (businessIds.length === 0) {
          try {
            const brands = await this.brandRepository.find({
              where: { ownerId: userId },
              relations: { businesses: true },
            });
            businessIds = brands.flatMap(b => b.businesses.map(biz => biz.id));
            if (businessIds.length === 0) {
              const biz = await this.businessRepository.findOne({ where: { ownerId: userId } });
              if (biz) businessIds.push(biz.id);
            }
          } catch (e) {
            this.logger.warn(`[WS] Impossible de reconstruire businessId pour ${userId}: ${e.message}`);
          }
        }
        businessIds.forEach(bid => {
          client.join(`${WsRooms.BUSINESS_PREFIX}${bid}`);
        });
        this.logger.log(`[WS] Marchand ${userId} rejoint ${businessIds.length} room(s) business`);
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
    const userRole = client.data?.user?.role;
    const userBusinessId = client.data?.user?.businessId;

    if (userRole !== UserRole.SUPER_ADMIN && userRole !== UserRole.ADMIN) {
      if (!userBusinessId || userBusinessId !== dto.businessId) {
        this.logger.warn(
          `[WS Auth] Socket ${client.id} tenté de rejoindre business ${dto.businessId} sans autorisation`,
        );
        return { event: 'error', data: 'Accès non autorisé à cette salle' };
      }
    }

    return this.roomHandler.handleJoinBusinessRoom(client, dto.businessId);
  }

  @SubscribeMessage(WsEvents.JOIN_ORDER_TRACKING)
  async handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinOrderTrackingDto,
  ) {
    // 🔒 La room est réservée aux parties prenantes de la commande :
    // le PIN de livraison y est diffusé (deliveryPendingConfirmation).
    const user = client.data?.user as { userId?: string; role?: string } | undefined;
    const role = user?.role;
    const userId = user?.userId;

    if (
      role !== UserRole.SUPER_ADMIN &&
      role !== UserRole.ADMIN &&
      role !== UserRole.SUPPORT
    ) {
      let order: Order | null = null;
      try {
        order = await this.orderRepository.findOne({
          where: { id: dto.orderId },
        });
      } catch {
        order = null;
      }

      const isOwner = !!userId && order?.clientId === userId;
      const isAssignedDriver =
        !!userId && !!order?.driverId && order.driverId === userId;

      if (!order || (!isOwner && !isAssignedDriver)) {
        this.logger.warn(
          `[WS Auth] Socket ${client.id} (${role ?? '?'}) refusé sur la room commande ${dto.orderId}`,
        );
        return { event: 'error', data: 'Accès non autorisé à cette salle' };
      }
    }

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
