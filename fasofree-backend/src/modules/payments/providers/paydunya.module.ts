import { Module } from '@nestjs/common';
import { PaydunyaService } from './paydunya.service';

@Module({
  providers: [PaydunyaService],
  exports: [PaydunyaService],
})
export class PaydunyaModule {}