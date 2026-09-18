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
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { Roles } from '../../core/security/roles.decorator';
import { RolesGuard } from '../../core/security/roles.guard';
import { UserRole } from '../users/entities/user-role.enum';
import { User } from '../users/entities/user.entity';
import {
  Order,
  OrderStatus,
} from '../orders/entities/order.entity';
import { Business } from '../businesses/entities/business.entity';
import { DispatchService } from './dispatch.service';
import { DispatchGateway } from './dispatch.gateway';

type RequestWithUser = ExpressRequest & {
  user?: { userId?: string; role?: string };
};

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
  ) {}

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

    const orders = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.status = :status', { status: OrderStatus.READY_FOR_PICKUP })
      .andWhere(
        `(o."dispatchCandidates" IS NULL OR NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(o."dispatchCandidates") AS cand
          WHERE cand->>'driverId' = :driverId
        ))`,
        { driverId },
      )
      .andWhere('o.fulfillmentType = :ft', { ft: 'DELIVERY' })
      .orderBy('o."dispatchedAt"', 'ASC')
      .limit(20)
      .getMany();

    // Enrichir avec les infos client et business
    const clientIds = [...new Set(orders.map(o => o.clientId).filter(Boolean))];
    const businessIds = [...new Set(orders.map(o => o.businessId).filter(Boolean))];
    
const [clients, businesses] = await Promise.all([
      clientIds.length > 0
        ? this.userRepository.findBy({ id: In(clientIds) })
        : Promise.resolve([]),
      businessIds.length > 0
        ? this.businessRepository.findBy({ id: In(businessIds) })
        : Promise.resolve([]),
    ]);
    
    const clientMap = new Map<string, { fullName: string; phone: string }>(clients.map(c => [c.id, { fullName: c.fullName || '', phone: c.phone || '' }]));
    const businessMap = new Map(businesses.map(b => [b.id, b.name]));

    const enriched = orders.map(order => {
      const client = clientMap.get(order.clientId);
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
        customerName: client?.fullName || 'Client',
        customerPhone: client?.phone || '',
        items: order.items || [],
        createdAt: order.createdAt,
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
    @Param('orderId') orderId: string,
    @Request() req: RequestWithUser,
  ) {
    const driverId = req.user?.userId;
    if (!driverId) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const order = await queryRunner.manager
        .createQueryBuilder(Order, 'o')
        .setLock('pessimistic_write')
        .where('o.id = :orderId', { orderId })
        .getOne();

      if (!order) {
        throw new NotFoundException(`Commande #${orderId} introuvable`);
      }

      const acceptableStatuses = [
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.PENDING,
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

      if (order.driverId === driverId) {
        await queryRunner.commitTransaction();
        return { success: true, orderId: order.id, status: order.status, driverId, message: 'Déjà assigné' };
      }

      const alreadyTried = (order.dispatchCandidates || []).some(
        (c) => c.driverId === driverId && c.refused,
      );
      if (alreadyTried) {
        throw new ForbiddenException(
          'Vous avez déjà refusé cette commande.',
        );
      }

      order.driverId = driverId;
      // READY_FOR_PICKUP → DRIVER_ASSIGNED, sinon → PROCESSING
      order.status = order.status === OrderStatus.READY_FOR_PICKUP
        ? OrderStatus.DRIVER_ASSIGNED
        : OrderStatus.PROCESSING;
      await queryRunner.manager.save(order);

      await queryRunner.manager.update(User, driverId, {
        isAvailable: false,
      });

      await queryRunner.commitTransaction();

      // Notifier toutes les parties prenantes
      this.dispatchGateway.broadcastOrderStatusChanged({
        id: order.id,
        status: order.status,
        driverId,
        businessId: order.businessId,
      });

      return {
        success: true,
        orderId: order.id,
        status: order.status,
        driverId,
        message: 'Course acceptée avec succès',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
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
    @Param('orderId') orderId: string,
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
