/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryAgency } from '../dispatch/entities/delivery-agency.entity';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { AgenciesController } from './agencies.controller';
import { AgenciesService } from './agencies.service';
import { PenaltiesModule } from '../penalties/penalties.module';

/**
 * 🏢 Module Agences partenaires (Niveau 2 du dispatch multi-niveaux).
 * DispatchModule est @Global : DispatchService et
 * DeliveryCallForTenderService sont injectables sans import.
 * PenaltiesModule est importé explicitement (il n'est pas @Global).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveryAgency, User, Order]),
    PenaltiesModule,
  ],
  controllers: [AgenciesController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}
