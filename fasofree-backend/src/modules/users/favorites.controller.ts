import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Request as NestRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { Request as ExpressRequest } from 'express';

type Req = ExpressRequest & { user?: { userId?: string } };

@ApiTags('Favorites')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('users/favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les favoris du client connecté' })
  async getFavorites(@NestRequest() req: Req) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.favoritesService.findAllByUser(userId);
  }

  @Get('ids')
  @ApiOperation({ summary: 'IDs des businesses favoris (pour l\'état des cœurs)' })
  async getFavoritedIds(@NestRequest() req: Req) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.favoritesService.getFavoritedIds(userId);
  }

  @Post(':businessId')
  @ApiOperation({ summary: 'Ajouter/Retirer un favori (toggle)' })
  @ApiResponse({ status: 201, description: 'Favori ajouté ou retiré' })
  async toggleFavorite(
    @NestRequest() req: Req,
    @Param('businessId') businessId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.favoritesService.toggle(userId, businessId);
  }
}
