import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DeliveryPenalty,
} from './entities/delivery-penalty.entity';
import { PenaltiesService } from './penalties.service';
import { PenaltiesController } from './penalties.controller';
import { DeliveryAgency } from '../dispatch/entities/delivery-agency.entity';

/**
 * ⚖️ Module des pénalités qualité (bloc C).
 *
 * Volontairement isolé : il ne dépend d'aucun autre module métier
 * (seulement d'entités), ce qui évite tout cycle avec OrdersModule ou
 * DispatchModule — les deux le consomment en lecture (scoring + alerte
 * de retard) et en écriture (avertissement automatique).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveryPenalty, DeliveryAgency]),
  ],
  controllers: [PenaltiesController],
  providers: [PenaltiesService],
  exports: [PenaltiesService],
})
export class PenaltiesModule {}
