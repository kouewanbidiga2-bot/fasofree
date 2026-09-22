import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { PdfImportService } from './pdf-import.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';
import { Business } from '../businesses/entities/business.entity';
import { BusinessesModule } from '../businesses/businesses.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Product, Business]),
    BusinessesModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, PdfImportService],
  exports: [ProductsService, PdfImportService],
})
export class ProductsModule {}
