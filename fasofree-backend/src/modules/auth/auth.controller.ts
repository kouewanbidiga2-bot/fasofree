import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Request,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ApplyDto } from './dto/apply.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 📝 Route publique : POST /auth/register
  @Post('register')
  @ApiOperation({ summary: 'Créer un compte utilisateur' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // 🚦 Route publique : POST /auth/apply (Candidature Marchand / Livreur avec KYC)
  @Post('apply')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      "Candidater comme Marchand ou Livreur (KYC). Le compte est créé en attente d'approbation.",
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'identityCard', maxCount: 1 },
      { name: 'driverLicense', maxCount: 1 },
      { name: 'vehicleRegistration', maxCount: 1 },
    ]),
  )
  async apply(
    @Body() dto: ApplyDto,
    @UploadedFiles() files?: Record<string, Express.Multer.File[]>,
  ) {
    return this.authService.apply(dto, files);
  }

  // 🔑 Route publique : POST /auth/login (Renvoie 200 OK au lieu de 201 Created)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Se connecter et obtenir un JWT' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // 👤 Route protégée : GET /auth/me (Obtenir le profil utilisateur connecté)
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir le profil utilisateur connecté' })
  async getMe(@Request() req) {
    return this.authService.getMe(req.user.userId);
  }

  // 🔑 Demande de réinitialisation du mot de passe
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  @ApiOperation({ summary: 'Demander un lien de réinitialisation du mot de passe' })
  async forgotPassword(@Body('email') email: string) {
    await this.authService.forgotPassword(email);
    return { message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' };
  }

  // 🔑 Réinitialiser le mot de passe avec le token
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  @ApiOperation({ summary: 'Réinitialiser le mot de passe avec le token reçu' })
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(token, newPassword);
  }

  // 🔑 Changer le mot de passe (utilisateur connecté)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Changer son mot de passe (connecté)' })
  async changePassword(
    @Request() req,
    @Body('currentPassword') currentPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.changePassword(req.user.userId, currentPassword, newPassword);
  }
}
