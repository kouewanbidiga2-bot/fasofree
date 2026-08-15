import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brand } from './entities/brand.entity';
import { Business } from '../businesses/entities/business.entity';
import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Brand, Business])],
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
