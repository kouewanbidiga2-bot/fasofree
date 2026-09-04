import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service';

@ApiTags('Loyalty')
@Controller('loyalty')
@UseGuards(AuthGuard('jwt'))
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get loyalty points balance' })
  async getBalance(@Req() req: any) {
    const balance = await this.loyaltyService.getPointsBalance(req.user.userId);
    return { success: true, data: { balance } };
  }

  @Get('me/history')
  @ApiOperation({ summary: 'Get loyalty points history' })
  async getHistory(@Req() req: any) {
    const history = await this.loyaltyService.getPointsHistory(req.user.userId);
    return { success: true, data: history };
  }

  @Get('referral/code')
  @ApiOperation({ summary: 'Get or generate referral code' })
  async getReferralCode(@Req() req: any) {
    const code = await this.loyaltyService.generateReferralCode(req.user.userId);
    return { success: true, data: { code } };
  }

  @Get('referral/stats')
  @ApiOperation({ summary: 'Get referral statistics' })
  async getReferralStats(@Req() req: any) {
    const stats = await this.loyaltyService.getReferralStats(req.user.userId);
    return { success: true, data: stats };
  }

  @Post('referral/apply')
  @ApiOperation({ summary: 'Apply a referral code' })
  async applyReferralCode(
    @Body() body: { code: string },
    @Req() req: any,
  ) {
    await this.loyaltyService.applyReferralCode(req.user.userId, body.code);
    return { success: true, message: 'Parrainage applique avec succes' };
  }
}
