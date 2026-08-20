import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request as NestRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QuoteOrderDto } from './dto/quote-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  ClientValidateDeliveryDto,
  DriverValidateDeliveryDto,
  DisputeOrderDto,
} from './dto/validate-delivery.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { UserRole } from '../users/entities/user-role.enum';
import { DisputesService } from '../disputes/disputes.service';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { OrderStatus } from './entities/order.entity';

type RequestWithUser = ExpressRequest & {
  user?: { userId?: string; role?: UserRole };
};

@ApiTags('Orders')
@ApiBearerAuth('JWT-auth')
@Controller('orders')
@UseGuards(AuthGuard('jwt')) // 🛡️ Toutes les routes de commandes nécessitent d'être connecté
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly disputesService: DisputesService,
  ) {}

  // 🎛️ Tour de contrôle : toutes les commandes (SUPER_ADMIN / ADMIN / SUPPORT)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Get()
  @ApiOperation({
    summary:
      'Tour de contrôle : toutes les commandes avec position live des livreurs (SUPER_ADMIN, ADMIN, SUPPORT)',
  })
  @ApiResponse({ status: 200, description: 'Liste globale des commandes' })
  async findAllForAdmin(
    @NestRequest() req: RequestWithUser,
    @Query('status') status?: string,
  ) {
    const role = req.user?.role;
    if (!role) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.ordersService.findAllForAdmin({
      status: status as OrderStatus | undefined,
    });
  }

  // 🛍️ Passer une commande
  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle commande' })
  @ApiResponse({ status: 201, description: 'Commande créée avec succès' })
  @ApiResponse({ status: 400, description: 'Données de la commande invalides' })
  @ApiResponse({ status: 401, description: 'Utilisateur non authentifié' })
  async createOrder(
    @NestRequest() req: RequestWithUser,
    @Body() dto: CreateOrderDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.ordersService.createOrder(userId, dto);
  }

  // 💬 Devis tarifaire (montants calculés & verrouillés côté serveur)
  @Post('quote')
  @ApiOperation({
    summary:
      'Obtenir un devis : sous-total, frais de livraison (min 800 FCFA), frais plateforme (100 FCFA) et total',
  })
  @ApiResponse({ status: 201, description: 'Devis calculé' })
  @ApiResponse({ status: 401, description: 'Utilisateur non authentifié' })
  @ApiResponse({ status: 400, description: 'Données de devis invalides' })
  async quoteOrder(
    @NestRequest() req: RequestWithUser,
    @Body() dto: QuoteOrderDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.ordersService.quoteOrder(userId, dto);
  }

  // 📋 Obtenir mes commandes
  @Get('my-orders')
  @ApiOperation({ summary: 'Lister les commandes du client connecté' })
  @ApiResponse({ status: 200, description: 'Liste des commandes récupérée' })
  @ApiResponse({ status: 401, description: 'Utilisateur non authentifié' })
  async getMyOrders(@NestRequest() req: RequestWithUser) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.ordersService.findClientOrders(userId);
  }

  // 🏪 Commandes d'un commerce (marchand connecté)
  @Get('business/:businessId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Lister les commandes d'un commerce (marchand)" })
  @ApiResponse({ status: 200, description: 'Commandes du commerce' })
  async getBusinessOrders(
    @NestRequest() req: RequestWithUser,
    @Param('businessId') businessId: string,
  ) {
    return this.ordersService.findAllByBusiness(businessId);
  }

  // 🔍 Détail d'une commande
  @Get(':id')
  @ApiOperation({ summary: "Obtenir le détail d'une commande par son ID" })
  @ApiResponse({ status: 200, description: 'Détail de la commande' })
  @ApiResponse({
    status: 401,
    description: 'Utilisateur non authentifié ou rôle manquant',
  })
  @ApiResponse({ status: 404, description: 'Commande introuvable' })
  async findOne(@NestRequest() req: RequestWithUser, @Param('id') id: string) {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId || !role) {
      throw new UnauthorizedException(
        'Utilisateur non authentifié ou rôle manquant',
      );
    }

    return this.ordersService.findOneForUser(id, userId, role);
  }

  // 🗺️ Suivi live GPS + estimateur de temps
  @Get(':id/tracking')
  @ApiOperation({
    summary:
      'Suivi live : statut, position GPS du livreur, tracé du parcours et ETA',
  })
  @ApiResponse({ status: 200, description: 'Données de suivi récupérées' })
  @ApiResponse({
    status: 401,
    description: 'Utilisateur non authentifié ou rôle manquant',
  })
  @ApiResponse({ status: 404, description: 'Commande introuvable' })
  async getOrderTracking(
    @Param('id') id: string,
    @NestRequest() req: RequestWithUser,
  ) {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId || !role) {
      throw new UnauthorizedException(
        'Utilisateur non authentifié ou rôle manquant',
      );
    }

    return this.ordersService.getOrderTracking(id, userId, role);
  }

  // 🔄 Changer le statut d'une commande
  @Patch(':id/status')
  @ApiOperation({ summary: "Mettre à jour le statut d'une commande" })
  @ApiResponse({ status: 200, description: 'Statut mis à jour avec succès' })
  @ApiResponse({ status: 400, description: 'Statut invalide' })
  @ApiResponse({ status: 401, description: 'Utilisateur non authentifié' })
  @ApiResponse({ status: 404, description: 'Commande introuvable' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId || !role) {
      throw new UnauthorizedException(
        'Utilisateur non authentifié ou rôle manquant',
      );
    }

    return this.ordersService.updateStatus(id, dto.status, userId, role);
  }

  // 🛵 Un livreur/coursier accepte une course (FOOD / P2P / RIDE)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.COURIER)
  @Post(':id/accept')
  @ApiOperation({
    summary:
      'Le livreur/coursier accepte une course (assignation driverId + statut PROCESSING)',
  })
  @ApiResponse({
    status: 201,
    description: 'Course acceptée — le GPS du livreur est diffusé au client',
  })
  @ApiResponse({
    status: 403,
    description: 'Non autorisé (rôle DRIVER/COURIER requis) ou course déjà acceptée',
  })
  @ApiResponse({ status: 400, description: 'Statut incompatible avec une acceptation' })
  async acceptOrder(@Param('id') id: string, @NestRequest() req: RequestWithUser) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.ordersService.acceptOrder(id, userId);
  }

  // ========================================================================
  // 🚚 VALIDATION DU LIVREUR/COURSIER
  // Le livreur signale qu'il a effectué la livraison
  // ========================================================================
  @Post(':id/driver-validate')
  @ApiOperation({
    summary: 'Le livreur/coursier confirme avoir effectué la livraison',
  })
  @ApiResponse({
    status: 200,
    description: 'Livraison marquée - en attente du Code PIN du client',
  })
  @ApiResponse({
    status: 403,
    description: 'Non autorisé (pas le bon livreur)',
  })
  async driverValidate(
    @Param('id') id: string,
    @Body() dto: DriverValidateDeliveryDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.ordersService.driverValidateDelivery(id, userId);
  }

  // ========================================================================
  // ✅ VALIDATION DU CLIENT AVEC CODE PIN
  // Le client confirme la réception en saisissant le Code PIN
  // ========================================================================
  @Post(':id/client-validate')
  @ApiOperation({
    summary: 'Le client confirme la réception avec son Code PIN à 4 chiffres',
  })
  @ApiResponse({ status: 200, description: 'Commande complétée avec succès !' })
  @ApiResponse({ status: 400, description: 'Code PIN invalide' })
  @ApiResponse({
    status: 403,
    description: 'Cette commande ne vous appartient pas',
  })
  async clientValidate(
    @Param('id') id: string,
    @Body() dto: ClientValidateDeliveryDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.ordersService.clientValidateWithPin(id, userId, dto.pinCode);
  }

  // ========================================================================
  // ⚠️ OUVRIR UN LITIGE (DISPUTE)
  // Le client conteste la livraison
  // ========================================================================
  @Post(':id/dispute')
  @ApiOperation({
    summary: 'Le client ouvre un litige sur une commande livrée',
  })
  @ApiResponse({ status: 200, description: 'Litige ouvert - commande gelée' })
  @ApiResponse({
    status: 400,
    description: 'Statut incompatible pour un litige',
  })
  @ApiResponse({
    status: 403,
    description: 'Cette commande ne vous appartient pas',
  })
  async disputeOrder(
    @Param('id') id: string,
    @Body() dto: DisputeOrderDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    await this.disputesService.open(id, userId, { reason: dto.reason, password: dto.password });
    // Compatibilité ascendante : cette route historique retournait la commande,
    // tandis que le nouveau détail du dossier est disponible sous /disputes.
    return this.ordersService.findOne(id);
  }
}
