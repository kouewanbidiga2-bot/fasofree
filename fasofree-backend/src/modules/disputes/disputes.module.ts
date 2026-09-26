import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletModule } from '../wallets/wallet.module';
import { UsersModule } from '../users/users.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { Order } from '../orders/entities/order.entity';
import { MerchantPayout } from '../payments/entities/merchant-payout.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';
import { DisputeListener } from './dispute.listener';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { DisputesGateway } from './disputes.gateway';
import { Dispute } from './entities/dispute.entity';
import { DisputeMessage } from './entities/dispute-message.entity';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dispute,
      DisputeMessage,
      Order,
      MerchantPayout,
      Transaction,
      User,
      Business,
    ]),
    NotificationsModule,
    WalletModule,
    UsersModule,
    BusinessesModule,
    forwardRef(() => DispatchModule),
  ],
  controllers: [DisputesController],
  providers: [DisputesService, DisputeListener, DisputesGateway],
  exports: [DisputesService],
})
export class DisputesModule {}
