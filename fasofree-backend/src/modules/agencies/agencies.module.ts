import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryAgency } from '../dispatch/entities/delivery-agency.entity';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { AgenciesController } from './agencies.controller';
import { AgenciesService } from './agencies.service';

/**
 * 🏢 Module Agences partenaires (Niveau 2 du dispatch multi-niveaux).
 * DispatchModule est @Global : DispatchService est injectable sans import.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DeliveryAgency, User, Order])],
  controllers: [AgenciesController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}
