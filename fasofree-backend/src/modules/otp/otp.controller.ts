import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OtpService } from './otp.service';

@ApiTags('OTP Verification')
@Controller('auth')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @HttpCode(HttpStatus.OK)
  @Post('send-otp')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Envoyer un code OTP de vérification' })
  async sendOtp(@Request() req) {
    return this.otpService.sendOtp(req.user.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify-otp')
  // 🛡️ Brute-force OTP : 5 essais max / 5 min par IP. Le code étant à 4-6
  // chiffres, un limiteur dédié est indispensable en plus du throttling global.
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vérifier le code OTP et activer le compte' })
  async verifyOtp(@Request() req, @Body() dto: { code: string }) {
    return this.otpService.verifyOtp(req.user.userId, dto.code);
  }

  @Post('check-verification')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vérifier si le compte est vérifié' })
  async checkVerification(@Request() req) {
    const verified = await this.otpService.isVerified(req.user.userId);
    return { verified };
  }
}
