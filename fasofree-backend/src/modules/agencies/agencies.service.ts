import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DeliveryAgency } from '../dispatch/entities/delivery-agency.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/entities/order.entity';
import { DispatchService } from '../dispatch/dispatch.service';
import { DeliveryCallForTenderService, AgencyOpenOffer } from '../dispatch/services/delivery-call-for-tender.service';
import { PenaltiesService } from '../penalties/penalties.service';
import { DeliveryOffer } from '../dispatch/entities/delivery-offer.entity';
import { DeliveryPenalty } from '../penalties/entities/delivery-penalty.entity';
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
    private readonly callForTender: DeliveryCallForTenderService,
    private readonly penaltiesService: PenaltiesService,
  ) {}

  // ─── SUPER_ADMIN : gestion des agences ─────────────────────────

  /**
   * 🧹 Normalise un champ texte optionnel : `undefined` (non fourni) reste
   * `undefined` pour ne pas écraser une valeur en mise à jour partielle, mais
   * une chaîne vide devient `null` (champ effacé).
   */
  private cleanText(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  async listAll(): Promise<DeliveryAgency[]> {
    return this.agencyRepository.find({ order: { createdAt: 'DESC' } });
  }

  async create(dto: CreateAgencyDto): Promise<DeliveryAgency> {
    const agency = this.agencyRepository.create({
      name: dto.name,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      // 🎨 Identité visuelle : une chaîne vide vaut « non renseigné » (null),
      // sinon un logo effacé réapparaîtrait sous forme d'URL vide.
      logoUrl: this.cleanText(dto.logoUrl),
      description: this.cleanText(dto.description),
      brandColor: this.cleanText(dto.brandColor),
      website: this.cleanText(dto.website),
      isVerified: dto.isVerified ?? false,
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
    // 🎨 Identité visuelle : `null` explicite (via chaîne vide) efface le champ.
    if (dto.logoUrl !== undefined) agency.logoUrl = this.cleanText(dto.logoUrl);
    if (dto.description !== undefined)
      agency.description = this.cleanText(dto.description);
    if (dto.brandColor !== undefined)
      agency.brandColor = this.cleanText(dto.brandColor);
    if (dto.website !== undefined) agency.website = this.cleanText(dto.website);
    if (dto.isVerified !== undefined) agency.isVerified = dto.isVerified;
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

  // ─── 📣 APPEL D'OFFRES MULTI-AGENCES (bloc A4) ────────────────

  /**
   * Offres encore ouvertes pour mon agence, enrichies de la commande.
   *
   * Distinct de `getDeliveries` : une offre n'a pas encore de
   * `deliveryProviderId` (aucune agence n'a gagné), elle n'apparaîtrait
   * donc jamais dans la liste des courses routées.
   */
  async getOpenOffers(agencyId: string): Promise<AgencyOpenOffer[]> {
    return this.callForTender.listOpenOffersForAgency(agencyId);
  }

  /**
   * ✅ Accepter une offre — « premier qui accepte gagne ».
   * L'acceptation est atomique (verrou sur la commande) : une seconde
   * agence qui clique au même instant reçoit un 400 explicite.
   */
  async acceptOffer(orderId: string, agencyId: string): Promise<Order> {
    return this.callForTender.acceptOffer(orderId, agencyId);
  }

  /** 🚫 Refuser une offre (l'appel d'offres continue pour les autres). */
  async refuseOffer(orderId: string, agencyId: string): Promise<DeliveryOffer> {
    return this.callForTender.refuseOffer(orderId, agencyId);
  }

  /** ⚖️ Sanctions qualité de mon agence (bloc C). */
  async getMyPenalties(agencyId: string): Promise<DeliveryPenalty[]> {
    return this.penaltiesService.listForAgency(agencyId);
  }

  /**
   * 📍 Vue temps réel de l'agence : positions de SES chauffeurs + courses actives.
   *
   * C'est le pendant, côté société, de la carte « Tour de contrôle » des
   * admins. Le périmètre est strictement borné à l'agence : elle ne voit
   * ni les chauffeurs ni les courses des autres sociétés.
   *
   * Les positions viennent de Redis (TTL) : un chauffeur qui n'a pas
   * émis depuis un moment n'a simplement pas de position — ce n'est pas
   * une erreur, et l'écran l'affiche comme « hors ligne ».
   */
  async getAgencyMap(agencyId: string) {
    const [drivers, orders] = await Promise.all([
      this.getDrivers(agencyId),
      this.getDeliveries(agencyId),
    ]);

    // Un chauffeur de l'agence n'est jamais assigné à une course d'une
    // autre agence (assignDelivery le vérifie) : une seule lecture suffit.
    const locations = await this.dispatchService.getDriversLocations(
      drivers.map((d) => d.id),
    );

    const ACTIVE_STATUSES = [
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.PROCESSING,
      OrderStatus.IN_DELIVERY,
    ];
    const activeOrders = orders.filter((o) =>
      ACTIVE_STATUSES.includes(o.status),
    );

    return {
      drivers: drivers.map((d) => ({
        id: d.id,
        name: d.fullName,
        phone: d.phone,
        vehicleType: d.vehicleType,
        isOnline: d.isOnline,
        isAvailable: d.isAvailable,
        averageRating: d.averageRating,
        location: locations.get(d.id) ?? null,
      })),
      orders: activeOrders.map((o) => ({
        id: o.id,
        ref: `#${o.id.slice(0, 8)}`,
        status: o.status,
        pickup: o.pickupLocation
          ? {
              latitude: o.pickupLocation.latitude,
              longitude: o.pickupLocation.longitude,
              address: o.pickupLocation.address,
            }
          : null,
        dropoff: o.dropoffLocation
          ? {
              latitude: o.dropoffLocation.latitude,
              longitude: o.dropoffLocation.longitude,
              address: o.dropoffLocation.address,
            }
          : null,
        driverId: o.driverId,
        driverLocation: o.driverId
          ? (locations.get(o.driverId) ?? null)
          : null,
        deliveryFee: Number(o.deliveryFee ?? 0),
      })),
    };
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
