import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';
import { Business } from '../businesses/entities/business.entity';
import { BusinessesModule } from '../businesses/businesses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Business]),
    BusinessesModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
