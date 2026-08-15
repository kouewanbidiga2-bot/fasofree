import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ReceiptsService } from './receipts.service';
import { ReceiptType } from './entities/receipt.entity';

@ApiTags('Receipts')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  @ApiOperation({ summary: 'Mes reçus (client, marchand ou livreur)' })
  @ApiQuery({ name: 'type', enum: ReceiptType, required: false })
  @ApiQuery({ name: 'limit', required: false, description: 'Max 50 (défaut)' })
  async myReceipts(
    @Request() req: Request & { user?: { userId?: string } },
    @Query('type') type?: ReceiptType,
    @Query('limit') limit?: string,
  ) {
    return this.receiptsService.findMyReceipts(req.user?.userId as string, {
      type,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un reçu (vérifie l’appartenance)' })
  async receiptById(
    @Request() req: Request & { user?: { userId?: string } },
    @Param('id') id: string,
  ) {
    return this.receiptsService.findMyReceiptById(req.user?.userId as string, id);
  }
}
