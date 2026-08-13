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

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: "Vérifie l'état de santé de l'API et de la base de données",
  })
  check() {
    return this.health.check([
      // Le timeout est passé à 5000ms pour éviter l'erreur 503
      () => this.db.pingCheck('database', { timeout: 5000 }),
    ]);
  }
}
