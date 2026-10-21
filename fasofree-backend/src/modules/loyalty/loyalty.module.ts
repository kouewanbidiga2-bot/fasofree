/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyListener } from './loyalty.listener';
import { LoyaltyPoint } from './entities/loyalty-point.entity';
import { Referral } from '../promotions/entities/referral.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LoyaltyPoint, Referral, User])],
  controllers: [LoyaltyController],
  providers: [LoyaltyService, LoyaltyListener],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
