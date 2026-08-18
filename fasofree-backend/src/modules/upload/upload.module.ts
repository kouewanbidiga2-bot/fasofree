import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadController } from './upload.controller';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { IStorageDriver } from './interfaces/storage-driver.interface';

/**
 * Token d'injection du driver de stockage "intelligent" :
 * 1. Cloudinary si CLOUDINARY_CLOUD_NAME configuré (production)
 * 2. S3 si les identifiants AWS sont configurés
 * 3. Disque local sinon (développement / fallback)
 */
export const STORAGE_DRIVER = 'STORAGE_DRIVER';

const storageDriverProvider: Provider = {
  provide: STORAGE_DRIVER,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): IStorageDriver => {
    const hasCloudinary =
      !!configService.get<string>('CLOUDINARY_CLOUD_NAME') &&
      !!configService.get<string>('CLOUDINARY_API_KEY') &&
      !!configService.get<string>('CLOUDINARY_API_SECRET');

    if (hasCloudinary) {
      return new CloudinaryStorageProvider(configService);
    }

    const hasAwsConfig =
      !!configService.get<string>('AWS_ACCESS_KEY_ID') &&
      !!configService.get<string>('AWS_SECRET_ACCESS_KEY') &&
      !!configService.get<string>('AWS_S3_BUCKET');

    if (hasAwsConfig) {
      return new S3StorageProvider(configService);
    }

    return new LocalStorageProvider();
  },
};

@Module({
  controllers: [UploadController],
  providers: [
    S3StorageProvider,
    LocalStorageProvider,
    CloudinaryStorageProvider,
    storageDriverProvider,
  ],
  exports: [
    STORAGE_DRIVER, // Driver "intelligent" (Cloudinary ↔ S3 ↔ local)
    CloudinaryStorageProvider, // Pour injection directe si besoin
  ],
})
export class UploadModule {}
