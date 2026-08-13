import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  IStorageDriver,
  UploadedFileResult,
} from '../interfaces/storage-driver.interface';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';

@Injectable()
export class S3StorageProvider implements IStorageDriver {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly cdnUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>(
      'AWS_S3_BUCKET',
      'default-bucket',
    );
    this.cdnUrl = this.configService.get<string>('AWS_S3_CDN_URL', '');

    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'eu-west-3'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', 'key'),
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
          'secret',
        ),
      },
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedFileResult> {
    const fileExtension = extname(file.originalname);
    const fileKey = `${folder}/${uuidv4()}${fileExtension}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: fileKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      const publicUrl = this.cdnUrl
        ? `${this.cdnUrl}/${fileKey}`
        : `https://${this.bucketName}.s3.amazonaws.com/${fileKey}`;

      return {
        url: publicUrl,
        key: fileKey,
        mimeType: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      this.logger.error(`Erreur S3 (${fileKey}):`, error);
      throw new InternalServerErrorException('Échec du stockage sur le Cloud');
    }
  }

  async uploadPrivateFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedFileResult> {
    const fileExtension = extname(file.originalname);
    const fileKey = `${folder}/${uuidv4()}${fileExtension}`;
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: fileKey,
          Body: file.buffer,
          ContentType: file.mimetype,
          ServerSideEncryption: 'AES256',
        }),
      );
      return {
        url: '',
        key: fileKey,
        mimeType: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      this.logger.error(`Erreur S3 privée (${fileKey}):`, error);
      throw new InternalServerErrorException(
        'Échec du stockage sécurisé du document',
      );
    }
  }

  async getSignedReadUrl(fileKey: string, expiresIn = 300): Promise<string> {
    return getSignedUrl(
      this.s3Client,
      new GetObjectCommand({ Bucket: this.bucketName, Key: fileKey }),
      { expiresIn },
    );
  }

  async deleteFile(fileKey: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: fileKey,
        }),
      );
    } catch (error) {
      this.logger.error(`Erreur suppression S3 (${fileKey}):`, error);
    }
  }
}
