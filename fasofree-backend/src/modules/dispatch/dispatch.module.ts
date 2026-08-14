import { Module, Global, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DispatchGateway } from './dispatch.gateway';
import { DispatchService } from './dispatch.service';
import { LocationHandler } from './handlers/location.handler';
import { RoomHandler } from './handlers/room.handler';
import { OrdersModule } from '../orders/orders.module';
import { UsersModule } from '../users/users.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';
import { Order } from '../orders/entities/order.entity';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, Business, Order]),
    ScheduleModule.forRoot(),
    forwardRef(() => OrdersModule),
    forwardRef(() => UsersModule),
    forwardRef(() => BusinessesModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_SECRET',
          'SUPER_SECRET_KEY_CHANGEME',
        ),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  providers: [DispatchGateway, DispatchService, LocationHandler, RoomHandler],
  exports: [DispatchGateway, DispatchService, JwtModule],
})
export class DispatchModule {}
