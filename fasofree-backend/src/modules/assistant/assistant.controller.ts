/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Body, Controller, Get, Post } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { AskAssistantDto } from './dto/ask-assistant.dto';
import { VoiceActionDto } from './dto/voice-action.dto';

/** Guide public des parcours de livraison Koliwa. */
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get()
  meta() {
    return this.assistantService.meta();
  }

  @Post('ask')
  ask(@Body() dto: AskAssistantDto) {
    return this.assistantService.ask(dto.question);
  }

  @Post('voice-action')
  voiceAction(@Body() dto: VoiceActionDto) {
    return this.assistantService.voiceAction(dto.question);
  }
}
