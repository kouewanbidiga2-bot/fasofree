/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
