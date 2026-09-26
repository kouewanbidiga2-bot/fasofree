import { Body, Controller, Get, Post } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { AskAssistantDto } from './dto/ask-assistant.dto';

/**
 * 🤖 Assistant FasoFree — guidance de la plateforme + conseils de menu.
 * Endpoint public (aucune donnée sensible) : les visiteurs peuvent poser
 * leurs questions sans être connectés. La limite de débit globale
 * (ThrottlerGuard) s'applique comme sur toutes les routes.
 */
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get()
  meta() {
    return this.assistantService.meta();
  }

  @Post('ask')
  ask(@Body() dto: AskAssistantDto) {
    return this.assistantService.ask(dto.question, dto.businessId);
  }
}