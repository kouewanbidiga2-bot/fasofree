import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  IStorageDriver,
  UploadedFileResult,
} from '../interfaces/storage-driver.interface';

/**
 * 🖥️ Stockage local (dev / fallback)
 *
 * Utilisé quand Amazon S3 n'est pas configuré (développement local).
 * Les fichiers sont écrits sous ./uploads/<folder>/<uuid><ext> et servis
 * par le backend sur l'URL publique /uploads/<folder>/<uuid><ext>.
 * Le storageKey stocké en base est le chemin relatif (ex: kyc/<ownerId>/xxx.jpg).
 */
@Injectable()
export class LocalStorageProvider implements IStorageDriver {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly rootDir = join(process.cwd(), 'uploads');

  private resolvePath(fileKey: string): string {
    // Sécurité : interdit toute remontée hors du dossier uploads
    const safeKey = fileKey.replace(/\.\.\//g, '').replace(/^\/+/, '');
    return join(this.rootDir, safeKey);
  }

  private publicUrl(fileKey: string): string {
    return `/uploads/${fileKey}`;
  }

  private async ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedFileResult> {
    const fileKey = `${folder}/${uuidv4()}${extname(file.originalname)}`;
    try {
      const absPath = this.resolvePath(fileKey);
      await this.ensureDir(join(this.rootDir, folder));
      await fs.writeFile(absPath, file.buffer);
      return {
        url: this.publicUrl(fileKey),
        key: fileKey,
        mimeType: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      this.logger.error(`Erreur stockage local (${fileKey}):`, error);
      throw new InternalServerErrorException(
        'Échec du stockage local du fichier',
      );
    }
  }

  async uploadPrivateFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedFileResult> {
    const fileKey = `${folder}/${uuidv4()}${extname(file.originalname)}`;
    try {
      const absPath = this.resolvePath(fileKey);
      await this.ensureDir(join(this.rootDir, folder));
      await fs.writeFile(absPath, file.buffer);
      return {
        url: this.publicUrl(fileKey),
        key: fileKey,
        mimeType: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      this.logger.error(`Erreur stockage local privé (${fileKey}):`, error);
      throw new InternalServerErrorException(
        'Échec du stockage local du document',
      );
    }
  }

  async getSignedReadUrl(fileKey: string): Promise<string> {
    return this.publicUrl(fileKey);
  }

  async deleteFile(fileKey: string): Promise<void> {
    try {
      const absPath = this.resolvePath(fileKey);
      await fs.unlink(absPath);
    } catch (error) {
      this.logger.error(`Erreur suppression locale (${fileKey}):`, error);
    }
  }
}
