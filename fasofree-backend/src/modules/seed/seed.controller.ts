import {
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { SeedCommand } from './seed.command';

@ApiTags('Seed')
@Controller('seed')
export class SeedController {
  constructor(private readonly seedCommand: SeedCommand) {}

  @Post('chitir-chicken')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seed Chitir Chicken branches + menu (super admin)' })
  async seedChitirChicken() {
    await this.seedCommand.seedChitirChicken();
    return { message: 'Chitir Chicken seed completed successfully' };
  }
}
