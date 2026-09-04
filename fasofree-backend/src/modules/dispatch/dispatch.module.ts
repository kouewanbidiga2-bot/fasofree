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
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';
import { Order } from '../orders/entities/order.entity';
import { resolveJwtSecret } from '../../config/jwt.config';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, Business, Order]),
    forwardRef(() => OrdersModule),
    forwardRef(() => UsersModule),
    forwardRef(() => BusinessesModule),
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
  providers: [DispatchGateway, DispatchService, LocationHandler, RoomHandler],
  exports: [DispatchGateway, DispatchService, JwtModule],
})
export class DispatchModule {}
