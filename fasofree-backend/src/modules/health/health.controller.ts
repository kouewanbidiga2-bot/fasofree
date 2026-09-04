import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  @ApiOperation({
    summary: "Liveness : l'instance est vivante (sans dépendance à la DB)",
  })
  live() {
    return this.health.check([
      () => ({ uptime: { status: 'up' } }),
    ]);
  }

  @Get()
  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary:
      "Readiness : l'API est prête à servir (vérifie la base de données)",
  })
  check() {
    return this.health.check([
      // Le timeout est passé à 5000ms pour éviter l'erreur 503
      () => this.db.pingCheck('database', { timeout: 5000 }),
    ]);
  }
}
