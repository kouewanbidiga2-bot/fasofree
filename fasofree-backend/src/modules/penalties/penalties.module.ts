/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DeliveryPenalty,
} from './entities/delivery-penalty.entity';
import { PenaltiesService } from './penalties.service';
import { PenaltiesController } from './penalties.controller';
import { DeliveryAgency } from '../dispatch/entities/delivery-agency.entity';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';

/**
 * ⚖️ Module des pénalités qualité (bloc C).
 *
 * Volontairement isolé : il ne dépend d'aucun autre module métier
 * (seulement d'entités), ce qui évite tout cycle avec OrdersModule ou
 * DispatchModule — les deux le consomment en lecture (scoring + alerte
 * de retard) et en écriture (avertissement automatique).
 *
 * `Order` / `User` / `Business` sont enregistrés pour l'écran de
 * supervision : résoudre « nom du livreur / de la société / du commerce »
 * et agréger les temps de livraison demande de les lire. Aucun service
 * n'est injecté depuis ces modules → toujours aucun cycle possible.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliveryPenalty,
      DeliveryAgency,
      Order,
      User,
      Business,
    ]),
  ],
  controllers: [PenaltiesController],
  providers: [PenaltiesService],
  exports: [PenaltiesService],
})
export class PenaltiesModule {}
