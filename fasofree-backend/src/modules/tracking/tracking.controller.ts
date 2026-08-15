import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TrackingService } from './tracking.service';
import { CalculateDistanceDto } from './dto/calculate-distance.dto';

@ApiTags('Tracking')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('calculate-fee')
  @ApiOperation({ summary: 'Calculer les frais de livraison' })
  @ApiResponse({ status: 200, description: 'Calcul réussi' })
  async calculateFee(@Body() dto: CalculateDistanceDto): Promise<any> {
    return this.trackingService.calculateDeliveryFee(dto);
  }
}
