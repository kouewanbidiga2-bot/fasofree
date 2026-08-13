import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Root')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: "Message d'accueil de l'API" })
  getHello() {
    return {
      name: 'FasoFree API',
      version: '1.0.0',
      status: 'operational',
      docs: '/api/docs',
    };
  }
}
