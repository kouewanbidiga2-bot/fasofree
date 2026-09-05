import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Request as NestRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { UserRole } from '../users/entities/user-role.enum';

type RequestWithUser = ExpressRequest & {
  user?: { userId?: string; role?: UserRole };
};

@ApiTags('Addresses')
@ApiBearerAuth('JWT-auth')
@Controller('users/me/addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  @ApiOperation({ summary: 'Lister mes adresses de livraison' })
  async findAll(@NestRequest() req: RequestWithUser) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Non authentifie');
    return this.addressesService.findAllByUser(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  @ApiOperation({ summary: 'Ajouter une adresse de livraison' })
  async create(@Body() dto: CreateAddressDto, @NestRequest() req: RequestWithUser) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Non authentifie');
    return this.addressesService.create(userId, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une adresse de livraison' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Non authentifie');
    return this.addressesService.update(userId, id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une adresse de livraison' })
  async remove(@Param('id') id: string, @NestRequest() req: RequestWithUser) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Non authentifie');
    return this.addressesService.remove(userId, id);
  }
}
