import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadController } from './upload.controller';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { IStorageDriver } from './interfaces/storage-driver.interface';

/**
 * Token d'injection du driver de stockage "intelligent" :
 * - S3 si les identifiants AWS sont configurés (production)
 * - Disque local sinon (développement / fallback)
 */
export const STORAGE_DRIVER = 'STORAGE_DRIVER';

const storageDriverProvider: Provider = {
  provide: STORAGE_DRIVER,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): IStorageDriver => {
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
    storageDriverProvider,
  ],
  exports: [
    S3StorageProvider, // Compatibilité historique (UploadController, etc.)
    STORAGE_DRIVER, // Driver "intelligent" (S3 ↔ local) pour les documents KYC
  ],
})
export class UploadModule {}
