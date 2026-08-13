import { Module, Global, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { DispatchGateway } from './dispatch.gateway';
import { LocationHandler } from './handlers/location.handler';
import { RoomHandler } from './handlers/room.handler';
import { OrdersModule } from '../orders/orders.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    forwardRef(() => OrdersModule),
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
  providers: [DispatchGateway, LocationHandler, RoomHandler],
  exports: [DispatchGateway, JwtModule],
})
export class DispatchModule {}
