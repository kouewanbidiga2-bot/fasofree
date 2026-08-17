import { Body, Controller, Get, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../core/security/roles.decorator';
import { RolesGuard } from '../../core/security/roles.guard';
import { UserRole } from '../users/entities/user-role.enum';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
@UseGuards(AuthGuard('jwt'))
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}
  @Get('quote') quote(
    @Query('code') code: string,
    @Query('amount') amount: string,
  ) {
    if (!code || !code.trim()) throw new BadRequestException('Le parametre code est requis');
    return this.promotions.quote(code, Number(amount || 0));
  }
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreatePromotionDto) {
    return this.promotions.create(dto);
  }
}
