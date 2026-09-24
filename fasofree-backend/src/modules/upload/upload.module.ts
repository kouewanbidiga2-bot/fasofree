import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadController } from './upload.controller';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import type { IStorageDriver } from './interfaces/storage-driver.interface';
import { STORAGE_DRIVER } from './upload.tokens';

const storageDriverProvider: Provider = {
  provide: STORAGE_DRIVER,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): IStorageDriver => {
    const hasCloudinary =
      !!configService.get<string>('CLOUDINARY_URL') ||
      (!!configService.get<string>('CLOUDINARY_CLOUD_NAME') &&
       !!configService.get<string>('CLOUDINARY_API_KEY') &&
       !!configService.get<string>('CLOUDINARY_API_SECRET'));

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

    // Garde explicite (non bloquante) : en production, tourner sur le driver
    // LOCAL fait perdre les fichiers à chaque redéploiement Render et les sert
    // publiquement (pièces KYC = données sensibles). Cloudinary/S3 est requis.
    if (configService.get<string>('NODE_ENV') === 'production') {
      console.error(
        '[Upload] ⚠️ PRODUCTION SANS STOCKAGE DURABLE : Cloudinary/S3 non configurés — ' +
          'driver LOCAL actif (fichiers non durables + servis sans authentification). ' +
          "Configurez CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET ou AWS_* dans Render.",
      );
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
