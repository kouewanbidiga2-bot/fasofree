import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { S3StorageProvider } from './providers/s3-storage.provider';

@Module({
  controllers: [UploadController],
  providers: [S3StorageProvider],
  exports: [S3StorageProvider], // Permet d'injecter la suppression dans d'autres modules (ex: ProductsModule)
})
export class UploadModule {}
