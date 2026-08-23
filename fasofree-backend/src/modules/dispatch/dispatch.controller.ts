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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles } from '../../core/security/roles.decorator';
import { RolesGuard } from '../../core/security/roles.guard';
import { UserRole } from '../users/entities/user-role.enum';
import {
  Order,
  OrderStatus,
} from '../orders/entities/order.entity';
import { Business } from '../businesses/entities/business.entity';

type RequestWithUser = ExpressRequest & {
  user?: { userId?: string; role?: string };
};

@ApiTags('Dispatch')
@ApiBearerAuth('JWT-auth')
@Controller('dispatch')
@UseGuards(AuthGuard('jwt'))
export class DispatchController {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
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
      .createQueryBuilder('order')
      .where('order.status = :status', { status: OrderStatus.READY_FOR_PICKUP })
      .andWhere(
        `(order."dispatchCandidates" IS NULL OR NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(order."dispatchCandidates") AS cand
          WHERE cand->>'driverId' = :driverId
        ))`,
        { driverId },
      )
      .andWhere('order.fulfillmentType = :ft', { ft: 'DELIVERY' })
      .orderBy('order."dispatchedAt"', 'ASC')
      .limit(20)
      .getMany();

    const enriched = await Promise.all(
      orders.map(async (order) => {
        let businessName = '';
        if (order.businessId) {
          const business = await this.businessRepository.findOne({
            where: { id: order.businessId },
          });
          businessName = business?.name || '';
        }
        return {
          id: order.id,
          orderId: order.id,
          status: order.status,
          orderType: order.orderType,
          pickupAddress: order.pickupLocation?.address || businessName,
          pickupLocation: order.pickupLocation
            ? { latitude: order.pickupLocation.latitude, longitude: order.pickupLocation.longitude }
            : null,
          deliveryLocation: order.deliveryLocation
            ? { latitude: order.deliveryLocation.latitude, longitude: order.deliveryLocation.longitude }
            : null,
          deliveryAddress: order.deliveryLocation
            ? `${order.deliveryLocation.latitude}, ${order.deliveryLocation.longitude}`
            : '',
          deliveryFee: Number(order.deliveryFee) || 0,
          totalAmount: Number(order.totalAmount) || 0,
          businessName,
          items: order.items || [],
          createdAt: order.createdAt,
        };
      }),
    );

    return enriched;
  }

  /**
   * 🎯 POST /dispatch/accept/:orderId
   * Le livreur accepte une course READY_FOR_PICKUP → DRIVER_ASSIGNED.
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

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Commande #${orderId} introuvable`);
    }

    if (order.status !== OrderStatus.READY_FOR_PICKUP) {
      throw new BadRequestException(
        `La commande est en statut "${order.status}". Seules les commandes READY_FOR_PICKUP peuvent être acceptées.`,
      );
    }

    // Vérifier que le livreur n'a pas déjà refusé cette commande
    const alreadyTried = (order.dispatchCandidates || []).some(
      (c) => c.driverId === driverId,
    );
    if (alreadyTried && order.driverId && order.driverId !== driverId) {
      throw new ForbiddenException(
        'Vous avez déjà refusé cette commande.',
      );
    }

    // Assigner le livreur
    order.driverId = driverId;
    order.status = OrderStatus.DRIVER_ASSIGNED;
    await this.orderRepository.save(order);

    return {
      success: true,
      orderId: order.id,
      status: order.status,
      driverId,
      message: 'Course acceptée avec succès',
    };
  }
}
