import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request as NestRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';

type RequestWithUser = ExpressRequest & {
  user?: { userId?: string };
};

@ApiTags('Reviews')
@ApiBearerAuth('JWT-auth') // Si ce nom correspond à celui dans main.ts ou l'auth config
@Controller('reviews')
@UseGuards(AuthGuard('jwt'))
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({
    summary: 'Laisser un avis et une note (avec pourboire optionnel)',
  })
  @ApiResponse({ status: 201, description: 'Avis créé avec succès' })
  @ApiResponse({
    status: 400,
    description: 'Avis déjà existant ou données invalides',
  })
  async createReview(
    @NestRequest() req: RequestWithUser,
    @Body() dto: CreateReviewDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Utilisateur non authentifié');
    return this.reviewsService.createReview(userId, dto);
  }

  @Get('target/:targetId')
  @ApiOperation({
    summary: "Obtenir les avis d'un livreur, coursier ou commerce",
  })
  @ApiResponse({ status: 200, description: 'Liste des avis' })
  async getReviewsForTarget(@Param('targetId') targetId: string) {
    return this.reviewsService.getReviewsForTarget(targetId);
  }

  @Get('target/:targetId/average')
  @ApiOperation({
    summary: "Obtenir la note moyenne d'un livreur, coursier ou commerce",
  })
  @ApiResponse({ status: 200, description: "Note moyenne et nombre d'avis" })
  async getAverageRating(@Param('targetId') targetId: string) {
    return this.reviewsService.getAverageRating(targetId);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: "Obtenir les avis d'une commande spécifique" })
  @ApiResponse({
    status: 200,
    description: 'Liste des avis pour cette commande',
  })
  async getReviewsForOrder(@Param('orderId') orderId: string) {
    return this.reviewsService.getReviewsForOrder(orderId);
  }
}
