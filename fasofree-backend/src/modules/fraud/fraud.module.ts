import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraudBlock } from './entities/fraud-block.entity';
import { FraudBlockService } from './fraud-block.service';
import { FraudController } from './fraud.controller';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([FraudBlock, Order, User]), AuditModule],
  controllers: [FraudController],
  providers: [FraudBlockService],
  exports: [FraudBlockService],
})
export class FraudModule {}
