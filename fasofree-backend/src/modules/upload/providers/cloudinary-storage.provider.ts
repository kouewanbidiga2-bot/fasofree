import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';
import {
  IStorageDriver,
  UploadedFileResult,
} from '../interfaces/storage-driver.interface';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class CloudinaryStorageProvider implements IStorageDriver, OnModuleInit {
  private readonly logger = new Logger(CloudinaryStorageProvider.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const cloudUrl = this.configService.get<string>('CLOUDINARY_URL');
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    // 1. Priorité aux 3 vars individuelles
    if (cloudName && apiKey && apiSecret) {
      const normalizedName = cloudName.trim().toLowerCase();
      cloudinary.config({
        cloud_name: normalizedName,
        api_key: apiKey.trim(),
        api_secret: apiSecret.trim(),
        secure: true,
      });
      this.logger.log(`[Cloudinary] Configuré via vars individuelles — cloud: ${normalizedName}`);
      return;
    }

    // 2. Fallback : CLOUDINARY_URL (format cloudinary://key:secret@cloud)
    if (cloudUrl) {
      cloudinary.config({ secure: true });
      this.logger.log('[Cloudinary] Configuré via CLOUDINARY_URL');
      return;
    }

    this.logger.warn(
      '[Cloudinary] Aucune variable configurée (CLOUDINARY_URL ou CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET)',
    );
  }

  // ─── VALIDATION ─────────────────────────────────────────────────────────────

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Type de fichier non supporté: ${file.mimetype}. Formats acceptés: JPEG, PNG, WebP`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `Fichier trop volumineux: ${(file.size / 1024 / 1024).toFixed(1)} Mo. Taille maximale: 5 Mo`,
      );
    }
  }

  // ─── UPLOAD BUFFER → CLOUDINARY ─────────────────────────────────────────────

  private uploadBuffer(
    file: Express.Multer.File,
    folder: string,
    resourceType: 'image' | 'raw' = 'image',
    accessType: 'public' | 'private' = 'public',
  ): Promise<{ secure_url: string; public_id: string }> {
    return new Promise((resolve, reject) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      const publicId = `${folder}/${uniqueSuffix}`;

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `fasofree/${folder}`,
          public_id: publicId,
          resource_type: resourceType,
          type: accessType === 'private' ? 'private' : 'upload',
          format: this.getFormat(file.mimetype),
          transformation: resourceType === 'image' ? [
            { quality: 'auto:good', fetch_format: 'auto' },
          ] : [],
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve(result);
          } else {
            reject(new Error('Cloudinary upload returned no result'));
          }
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  private getFormat(mimetype: string): string | undefined {
    switch (mimetype) {
      case 'image/jpeg': return 'jpg';
      case 'image/png': return 'png';
      case 'image/webp': return 'webp';
      case 'application/pdf': return 'pdf';
      default: return undefined;
    }
  }

  // ─── IStorageDriver IMPLEMENTATION ───────────────────────────────────────────

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedFileResult> {
    this.validateFile(file);

    try {
      const result = await this.uploadBuffer(file, folder, 'image', 'public');

      return {
        url: result.secure_url,
        key: result.public_id,
        mimeType: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      const detail = error?.message || JSON.stringify(error) || 'Erreur inconnue';
      this.logger.error(`[Cloudinary] Échec upload public (${folder}): ${detail}`);
      if (error?.http_code) {
        this.logger.error(`[Cloudinary] HTTP ${error.http_code} — ${error.message}`);
      }
      throw new BadRequestException(
        `Échec de l'upload: ${detail}`,
      );
    }
  }

  async uploadPrivateFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedFileResult> {
    this.validateFile(file);

    try {
      const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';
      const result = await this.uploadBuffer(file, folder, resourceType, 'private');

      return {
        url: '', // Document privé : pas d'URL publique
        key: result.public_id,
        mimeType: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      const detail = error?.message || JSON.stringify(error) || 'Erreur inconnue';
      this.logger.error(`[Cloudinary] Échec upload privé (${folder}): ${detail}`);
      throw new BadRequestException(
        `Échec de l'upload du document: ${detail}`,
      );
    }
  }

  /**
   * Génère une URL signée temporaire pour un document privé (KYC).
   * Valide 5 minutes par défaut.
   */
  async getSignedReadUrl(fileKey: string, expiresIn = 300): Promise<string> {
    try {
      const url = cloudinary.url(fileKey, {
        type: 'authenticated',
        resource_type: 'auto',
        sign_url: true,
        secure: true,
        expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      });
      return url;
    } catch (error) {
      this.logger.error(`[Cloudinary] Échec URL signée (${fileKey}):`, error);
      throw new InternalServerErrorException('Impossible de générer l\'URL du document');
    }
  }

  async deleteFile(fileKey: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(fileKey, {
        resource_type: 'auto',
      });
      this.logger.debug(`[Cloudinary] Fichier supprimé: ${fileKey}`);
    } catch (error) {
      this.logger.error(`[Cloudinary] Échec suppression (${fileKey}):`, error);
    }
  }
}
