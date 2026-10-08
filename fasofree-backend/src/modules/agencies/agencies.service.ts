import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DeliveryAgency } from '../dispatch/entities/delivery-agency.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { Order } from '../orders/entities/order.entity';
import { DispatchService } from '../dispatch/dispatch.service';
import { CreateAgencyDto, UpdateAgencyDto } from './dto/agency.dto';

/**
 * 🏢 Gestion des agences partenaires (Niveau 2 du dispatch multi-niveaux).
 *
 * - SUPER_ADMIN : CRUD des agences (commission, zones, capacité, actif).
 * - AGENCY      : consulte les courses routées vers son agence et les
 *   assigne à SES chauffeurs (le chauffeur est un DRIVER classique :
 *   validation livraison, PIN et paiements inchangés).
 */
@Injectable()
export class AgenciesService {
  private readonly logger = new Logger(AgenciesService.name);

  constructor(
    @InjectRepository(DeliveryAgency)
    private readonly agencyRepository: Repository<DeliveryAgency>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dispatchService: DispatchService,
  ) {}

  // ─── SUPER_ADMIN : gestion des agences ─────────────────────────

  async listAll(): Promise<DeliveryAgency[]> {
    return this.agencyRepository.find({ order: { createdAt: 'DESC' } });
  }

  async create(dto: CreateAgencyDto): Promise<DeliveryAgency> {
    const agency = this.agencyRepository.create({
      name: dto.name,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      zones: dto.zones ?? null,
      commissionPct: dto.commissionPct ?? 10,
      maxConcurrentDeliveries: dto.maxConcurrentDeliveries ?? 0,
      isActive: dto.isActive ?? true,
      userId: dto.userId ?? null,
    });
    const saved = await this.agencyRepository.save(agency);
    this.logger.log(`[Agencies] Agence "${saved.name}" créée (${saved.id})`);
    return saved;
  }

  async update(
    id: string,
    dto: UpdateAgencyDto,
  ): Promise<DeliveryAgency> {
    const agency = await this.agencyRepository.findOne({ where: { id } });
    if (!agency) {
      throw new Error(`Agence ${id} introuvable`);
    }
    if (dto.name !== undefined) agency.name = dto.name;
    if (dto.phone !== undefined) agency.phone = dto.phone;
    if (dto.email !== undefined) agency.email = dto.email;
    if (dto.zones !== undefined) agency.zones = dto.zones;
    if (dto.commissionPct !== undefined)
      agency.commissionPct = dto.commissionPct;
    if (dto.maxConcurrentDeliveries !== undefined)
      agency.maxConcurrentDeliveries = dto.maxConcurrentDeliveries;
    if (dto.isActive !== undefined) agency.isActive = dto.isActive;
    if (dto.userId !== undefined) agency.userId = dto.userId;
    return this.agencyRepository.save(agency);
  }

  // ─── AGENCY : espace agence ────────────────────────────────────

  /** Profil de l'agence du compte connecté */
  async getMyAgency(userId: string): Promise<DeliveryAgency | null> {
    return this.agencyRepository.findOne({ where: { userId } });
  }

  /** Courses routées vers mon agence (assignées ou en attente) */
  async getDeliveries(agencyId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { deliveryProviderId: agencyId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  /** Chauffeurs rattachés à mon agence */
  async getDrivers(agencyId: string): Promise<User[]> {
    return this.userRepository.find({
      where: {
        agencyId,
        role: In([UserRole.DRIVER, UserRole.COURIER]),
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        vehicleType: true,
        isOnline: true,
        isAvailable: true,
        averageRating: true,
        latitude: true,
        longitude: true,
      },
    });
  }

  /**
   * 🎯 Assigner une course routée vers mon agence à un de MES chauffeurs.
   * Réutilise l'assignation existante (statut, notification, broadcast) —
   * le déroulé livraison/PIN/paiement est inchangé.
   */
  async assignDelivery(
    orderId: string,
    agencyId: string,
    driverId: string,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new Error('Commande introuvable');
    }
    if (order.deliveryProviderId !== agencyId) {
      throw new Error("Cette course n'est pas routée vers votre agence");
    }
    if (order.driverId) {
      throw new Error('Course déjà assignée à un chauffeur');
    }

    const driver = await this.userRepository.findOne({
      where: {
        id: driverId,
        agencyId,
        role: In([UserRole.DRIVER, UserRole.COURIER]),
      },
    });
    if (!driver) {
      throw new Error('Chauffeur introuvable dans votre agence');
    }

    const updated = await this.dispatchService.assignDriverToOrder(
      orderId,
      driverId,
    );
    updated.deliveryProviderStatus = 'ACCEPTED';
    await this.orderRepository.save(updated);

    this.logger.log(
      `[Agencies] Course #${orderId} assignée par l'agence ${agencyId} au chauffeur ${driverId}`,
    );
    return updated;
  }
}
