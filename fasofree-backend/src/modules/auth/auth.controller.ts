import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';

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
}
