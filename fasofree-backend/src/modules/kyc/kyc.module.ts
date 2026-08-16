import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadModule } from '../upload/upload.module';
import { KycController } from './kyc.controller';
import { KycDocument } from './entities/kyc-document.entity';
import { KycService } from './kyc.service';

@Module({
  imports: [TypeOrmModule.forFeature([KycDocument]), UploadModule],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
