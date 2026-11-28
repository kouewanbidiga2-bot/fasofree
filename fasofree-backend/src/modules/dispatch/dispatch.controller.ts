/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Body,
  ParseUUIDPipe,
  ServiceUnavailableException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { Roles } from '../../core/security/roles.decorator';
import { RolesGuard } from '../../core/security/roles.guard';
import { UserRole } from '../users/entities/user-role.enum';
import { User } from '../users/entities/user.entity';
import {
  FulfillmentType,
  Order,
  OrderStatus,
  OrderType,
} from '../orders/entities/order.entity';
import { GeoDispatchService } from '../orders/dispatch.service';
import { Business } from '../businesses/entities/business.entity';
import { DispatchService } from './dispatch.service';
import { DispatchGateway } from './dispatch.gateway';
import { OrdersService } from '../orders/orders.service';
import { NotificationStoreService } from '../notifications/notification-store.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import {
  ACTIVE_DELIVERY_STATUSES,
  activeP2pOffer,
  deliveryDistanceKm,
  DISPATCH_ZONE_RADIUS_KM,
  isCompatibleDeliveryZone,
  isOpenP2pOrder,
  MAX_ACTIVE_DELIVERIES_PER_DRIVER,
  P2P_GPS_MAX_AGE_MS,
  P2P_WAVE_RADII_KM,
} from './delivery-rules';

type RequestWithUser = ExpressRequest & {
  user?: { userId?: string; role?: string };
};

const SUPPORT_REASONS = ['Adresse introuvable', 'Contact injoignable', 'Problème avec le colis', 'Autre problème'];

class CourierSupportDto {
  @IsIn(SUPPORT_REASONS)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  details?: string;
}

@ApiTags('Dispatch')
@ApiBearerAuth('JWT-auth')
@Controller('dispatch')
@UseGuards(AuthGuard('jwt'))
export class DispatchController {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dispatchService: DispatchService,
    private readonly dispatchGateway: DispatchGateway,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly geo: GeoDispatchService,
    private readonly notifications: NotificationStoreService,
  ) {}

  @Get('my-earnings-today')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.COURIER)
  async getTodayEarnings(@Request() req: RequestWithUser) {
    const driverId = req.user?.userId;
    if (!driverId) throw new ForbiddenException();
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86_400_000);
    const result = await this.orderRepository.createQueryBuilder('o')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(GREATEST(0, o."deliveryFee" - COALESCE(o."driverCommissionAmount", 0))), 0)', 'net')
      .where('o."driverId" = :driverId', { driverId })
      .andWhere('o.status IN (:...statuses)', { statuses: [OrderStatus.COMPLETED, OrderStatus.DELIVERED] })
      .andWhere('COALESCE(o."deliveredAt", o."clientValidatedAt", o."updatedAt") >= :start', { start })
      .andWhere('COALESCE(o."deliveredAt", o."clientValidatedAt", o."updatedAt") < :end', { end })
      .getRawOne<{ count: string; net: string }>();
    return { count: Number(result?.count ?? 0), net: Number(result?.net ?? 0) };
  }

  @Post('support/:orderId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.COURIER)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async contactSupport(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CourierSupportDto,
    @Request() req: RequestWithUser,
  ) {
    const driverId = req.user?.userId;
    if (!driverId) throw new ForbiddenException();
    const order = await this.orderRepository.findOneBy({
      id: orderId, driverId, status: In([...ACTIVE_DELIVERY_STATUSES]),
    });
    if (!order) throw new ForbiddenException('Cette course active ne vous est pas attribuée.');
    const team = await this.userRepository.find({
      where: { role: In([UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPER_ADMIN]), isActive: true },
      select: { id: true },
    });
    if (!team.length) throw new ServiceUnavailableException('Aucun agent de support n’est actuellement joignable.');
    const reference = order.trackingReference ?? order.id;
    const details = dto.details?.trim();
    await this.notifications.sendToUsers(
      team.map(agent => agent.id),
      'Assistance coursier',
      [`Course ${reference}`, dto.reason, details].filter(Boolean).join(' · '),
      NotificationType.DELIVERY,
    );
    return { sent: true };
  }

  /**
   * 📋 GET /dispatch/available
   * Liste les commandes READY_FOR_PICKUP (en attente de livreur).
   * Accessible aux DRIVERS / COURIERS.
   */
  @Get('available')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.COURIER)
  @ApiOperation({ summary: 'Courses disponibles (READY_FOR_PICKUP)' })
  async getAvailableOrders(
    @Request() req: RequestWithUser,
  ) {
    const driverId = req.user?.userId;

    if (!driverId) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    const activeDeliveryCount = await this.orderRepository.count({
      where: {
        driverId,
        status: In([...ACTIVE_DELIVERY_STATUSES]),
      },
    });

    // Le livreur reste connecté mais ne reçoit plus de nouvelles missions
    // lorsqu'il a atteint la capacité opérationnelle configurée.
    if (activeDeliveryCount >= MAX_ACTIVE_DELIVERIES_PER_DRIVER) {
      return [];
    }

    const driver = await this.userRepository.findOneBy({ id: driverId });
    if (!driver?.isActive || !driver.isOnline || !driver.isAvailable) return [];

    const orders = await this.orderRepository
      .createQueryBuilder('o')
      .where('o."driverId" IS NULL AND o."deliveryProviderId" IS NULL')
      .andWhere(
        `(
          (o."orderType" = :p2p AND o.status IN (:...openStatuses)
            AND o."paymentTransactionRef" IS NOT NULL AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(o."dispatchCandidates") cand
              WHERE cand->>'driverId' = :driverId
                AND cand->>'offerExpiresAt' > :now
                AND COALESCE(cand->>'refused', 'false') = 'false'
            ))
          OR (o."orderType" <> :p2p AND o.status = :ready AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(o."dispatchCandidates") cand
            WHERE cand->>'driverId' = :driverId AND cand->>'refused' = 'true'
          ))
        )`,
        {
          p2p: OrderType.P2P_DELIVERY, openStatuses: [OrderStatus.PAID, OrderStatus.READY_FOR_PICKUP],
          ready: OrderStatus.READY_FOR_PICKUP, driverId, now: new Date().toISOString(),
        },
      )
      .andWhere('o.fulfillmentType = :ft', { ft: 'DELIVERY' })
      .orderBy('o."dispatchedAt"', 'ASC')
      .limit(20)
      .getMany();

    const businessIds = [...new Set(orders.map((order) => order.businessId).filter(Boolean))];
    const businesses = businessIds.length ? await this.businessRepository.findBy({ id: In(businessIds) }) : [];
    const businessMap = new Map(businesses.map((business) => [business.id, business.name]));

    const enriched = orders.map(order => {
      if (order.orderType === OrderType.P2P_DELIVERY) {
        const offer = activeP2pOffer(order, driverId);
        return {
          id: order.id, status: order.status, orderType: order.orderType,
          trackingReference: order.trackingReference,
          pickupLocation: { address: 'Ramassage à Ouagadougou' },
          dropoffLocation: { address: 'Remise à Ouagadougou' },
          pickupDistanceKm: offer?.pickupDistanceKm,
          expiresAt: offer?.offerExpiresAt,
          deliveryFee: Number(order.deliveryFee),
          driverCommissionAmount: Number(order.driverCommissionAmount ?? 0),
        };
      }
      const businessName = businessMap.get(order.businessId) || '';
      
      return {
        id: order.id,
        orderId: order.id,
        status: order.status,
        orderType: order.orderType,
        pickupAddress: (order.pickupLocation as any)?.address || businessName,
        pickupLocation: order.pickupLocation
          ? { latitude: order.pickupLocation.latitude, longitude: order.pickupLocation.longitude }
          : null,
        deliveryLocation: order.deliveryLocation
          ? { latitude: order.deliveryLocation.latitude, longitude: order.deliveryLocation.longitude }
          : null,
        deliveryAddress: (order.deliveryLocation as any)?.address || '',
        deliveryFee: Number(order.deliveryFee) || 0,
        totalAmount: Number(order.totalAmount) || 0,
        businessName,
        items: order.items || [],
        createdAt: order.createdAt,
        activeDeliveryCount,
        maxActiveDeliveries: MAX_ACTIVE_DELIVERIES_PER_DRIVER,
        dispatchZoneRadiusKm: DISPATCH_ZONE_RADIUS_KM,
      };
    });

    return enriched;
  }

  /**
   * 🎯 POST /dispatch/accept/:orderId
   * Le livreur accepte une course :
   * - READY_FOR_PICKUP → DRIVER_ASSIGNED (dispatch classique)
   * - PENDING/PAID → PROCESSING (acceptation directe)
   * Accessible aux DRIVERS / COURIERS.
   */
  @Post('accept/:orderId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.COURIER)
  @ApiOperation({ summary: 'Accepter une course disponible' })
  async acceptOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Request() req: RequestWithUser,
  ) {
    const driverId = req.user?.userId;
    if (!driverId) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager
        .createQueryBuilder(Order, 'o')
        .setLock('pessimistic_write')
        .where('o.id = :orderId', { orderId })
        .getOne();

      if (!order) {
        throw new NotFoundException(`Commande #${orderId} introuvable`);
      }

      // Verrouiller la ligne utilisateur sérialise les acceptations
      // concurrentes de plusieurs missions par le même livreur.
      const driver = await queryRunner.manager
        .createQueryBuilder(User, 'u')
        .setLock('pessimistic_write')
        .where('u.id = :driverId', { driverId })
        .getOneOrFail();

      if (order.driverId === driverId) {
        await queryRunner.commitTransaction();
        return { success: true, orderId: order.id, status: order.status, driverId, message: 'Déjà assigné' };
      }
      if (!driver.isActive || !driver.isOnline || !driver.isAvailable
        || ![UserRole.DRIVER, UserRole.COURIER].includes(driver.role)) {
        throw new ForbiddenException('Passez en ligne pour accepter une livraison.');
      }
      if (order.fulfillmentType !== FulfillmentType.DELIVERY || order.deliveryProviderId) {
        throw new ForbiddenException('Cette livraison n’est plus disponible.');
      }

      const acceptableStatuses = [
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.PAID,
      ];
      if (!acceptableStatuses.includes(order.status)) {
        throw new BadRequestException(
          `La commande est en statut "${order.status}". Statuts acceptés : ${acceptableStatuses.join(', ')}`,
        );
      }

      if (order.driverId && order.driverId !== driverId) {
        throw new BadRequestException(
          'Cette commande a déjà été assignée à un autre livreur.',
        );
      }

      const isP2p = order.orderType === OrderType.P2P_DELIVERY;
      if (isP2p) {
        const location = await this.geo.getDriverLocation(driverId);
        const distance = deliveryDistanceKm(location, order.pickupLocation);
        const radius = P2P_WAVE_RADII_KM[order.p2pDispatchWave - 1];
        if (!isOpenP2pOrder(order) || !activeP2pOffer(order, driverId) || radius == null
          || !location || Date.now() - location.updatedAt > P2P_GPS_MAX_AGE_MS
          || distance == null || distance > radius) {
          throw new ForbiddenException('Offre expirée ou position GPS actuelle hors du périmètre.');
        }
      }

      const activeOrders = await queryRunner.manager.getRepository(Order).find({
        where: {
          driverId,
          status: In([...ACTIVE_DELIVERY_STATUSES]),
        },
      });
      const activeDeliveryCount = activeOrders.length;

      if (activeDeliveryCount >= MAX_ACTIVE_DELIVERIES_PER_DRIVER) {
        throw new BadRequestException(
          `Vous avez déjà ${MAX_ACTIVE_DELIVERIES_PER_DRIVER} livraisons actives. Terminez-en une avant d'en accepter une autre.`,
        );
      }

      if (!isCompatibleDeliveryZone(order, activeOrders)) {
        throw new BadRequestException(
          `Cette course est hors de votre zone de cumul (${DISPATCH_ZONE_RADIUS_KM} km). Terminez vos missions actuelles ou acceptez-la avec un autre livreur.`,
        );
      }

      const alreadyTried = (order.dispatchCandidates || []).some(
        (c) => c.driverId === driverId && c.refused,
      );
      if (alreadyTried) {
        throw new ForbiddenException(
          'Vous avez déjà refusé cette commande.',
        );
      }

      const previousStatus = order.status;
      order.driverId = driverId;
      // READY_FOR_PICKUP → DRIVER_ASSIGNED, sinon → PROCESSING
      order.status = isP2p || order.status === OrderStatus.READY_FOR_PICKUP
        ? OrderStatus.DRIVER_ASSIGNED
        : OrderStatus.PROCESSING;
      order.nextP2pDispatchAt = null;
      await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();

      if (isP2p) this.dispatchGateway.notifyP2pOfferClosed(order);
      // Notifier toutes les parties prenantes
      this.dispatchGateway.broadcastOrderStatusChanged({
        id: order.id,
        status: order.status,
        driverId,
        businessId: order.businessId,
      });

      // 📱 Notifications push / in-app (client + livreur) — transitions
      //    DRIVER_ASSIGNED / PROCESSING
      try {
        await this.ordersService.sendStatusNotifications(order, previousStatus);
      } catch (err) {
        // Ne jamais bloquer l'acceptation pour un problème de notif
      }

      return {
        success: true,
        orderId: order.id,
        status: order.status,
        driverId,
        message: 'Course acceptée avec succès',
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 🚫 POST /dispatch/refuse/:orderId
   * Le livreur refuse une course → passe au candidat suivant.
   */
  @Post('refuse/:orderId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.COURIER)
  @ApiOperation({ summary: 'Refuser une course disponible' })
  async refuseOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Request() req: RequestWithUser,
  ) {
    const driverId = req.user?.userId;
    if (!driverId) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    await this.dispatchService.refuseOrder(orderId, driverId);

    return {
      success: true,
      orderId,
      message: 'Course refusée',
    };
  }
}
