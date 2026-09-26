import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { Product } from '../products/entities/product.entity';
import { Business } from '../businesses/entities/business.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Business])],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}