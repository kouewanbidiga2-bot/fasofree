import { Module } from '@nestjs/common';
import { GoogleMapsService } from './services/google-maps.service';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';

@Module({
  controllers: [TrackingController],
  providers: [GoogleMapsService, TrackingService],
  exports: [TrackingService, GoogleMapsService],
})
export class TrackingModule {}
