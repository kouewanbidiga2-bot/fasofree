/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Module } from '@nestjs/common';
import { PaydunyaService } from './paydunya.service';

@Module({
  providers: [PaydunyaService],
  exports: [PaydunyaService],
})
export class PaydunyaModule {}