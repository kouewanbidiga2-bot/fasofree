import { Module, Global, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DispatchGateway } from './dispatch.gateway';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { LocationHandler } from './handlers/location.handler';
import { RoomHandler } from './handlers/room.handler';
import { OrdersModule } from '../orders/orders.module';
import { UsersModule } from '../users/users.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { BrandsModule } from '../brands/brands.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';
import { Order } from '../orders/entities/order.entity';
import { Brand } from '../brands/entities/brand.entity';
import { DeliveryAgency } from './entities/delivery-agency.entity';
import { DeliveryOffer } from './entities/delivery-offer.entity';
import { DriverScoringService } from './services/driver-scoring.service';
import { DeliverySlaService } from './services/delivery-sla.service';
import { DeliveryCallForTenderService } from './services/delivery-call-for-tender.service';
import { DeliveryProviderRegistry } from './providers/delivery-provider.registry';
import { InternalFleetProvider } from './providers/internal-fleet.provider';
import { AgencyProvider } from './providers/agency.provider';
import { ManualProvider } from './providers/manual.provider';
import { PenaltiesModule } from '../penalties/penalties.module';
import { resolveJwtSecret } from '../../config/jwt.config';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      User,
      Business,
      Order,
      Brand,
      DeliveryAgency,
      DeliveryOffer,
    ]),
    forwardRef(() => OrdersModule),
    forwardRef(() => UsersModule),
    forwardRef(() => BusinessesModule),
    forwardRef(() => BrandsModule),
    NotificationsModule,
    PenaltiesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: resolveJwtSecret(configService),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [DispatchController],
  providers: [
    DispatchGateway,
    DispatchService,
    LocationHandler,
    RoomHandler,
    // 🧭 Dispatch multi-niveaux (Delivery Providers / Fallback)
    DriverScoringService,
    DeliverySlaService,
    DeliveryCallForTenderService,
    DeliveryProviderRegistry,
    InternalFleetProvider,
    AgencyProvider,
    ManualProvider,
  ],
  exports: [
    DispatchGateway,
    DispatchService,
    DeliveryProviderRegistry,
    DriverScoringService,
    DeliverySlaService,
    DeliveryCallForTenderService,
    JwtModule,
  ],
})
export class DispatchModule {}
