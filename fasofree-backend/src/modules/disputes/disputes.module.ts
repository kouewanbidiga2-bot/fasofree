import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { Order } from '../orders/entities/order.entity';
import { MerchantPayout } from '../payments/entities/merchant-payout.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { DisputeListener } from './dispute.listener';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { Dispute } from './entities/dispute.entity';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispute, Order, MerchantPayout, Transaction]),
    NotificationsModule,
    forwardRef(() => DispatchModule),
  ],
  controllers: [DisputesController],
  providers: [DisputesService, DisputeListener],
  exports: [DisputesService],
})
export class DisputesModule {}
