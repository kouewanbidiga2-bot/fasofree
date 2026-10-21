/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Audited } from '../audit/audited.decorator';

@ApiTags('Settings')
@ApiBearerAuth('JWT-auth')
@Controller('admin/settings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer les paramètres globaux de la plateforme' })
  get() {
    return this.settingsService.get();
  }

  @Get('business-categories')
  @ApiOperation({
    summary:
      'Catalogue complet des verticales de commerces + état actif (pour les interrupteurs)',
  })
  getBusinessCategories() {
    return this.settingsService.getBusinessCategoryCatalog();
  }

  @Patch()
  @Audited({ action: 'settings.update', entityType: 'SYSTEM_SETTINGS' })
  @ApiOperation({ summary: 'Mettre à jour les paramètres globaux (super admin)' })
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(dto);
  }
}
