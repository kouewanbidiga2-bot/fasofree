export interface UploadedFileResult {
  url: string;
  key: string;
  mimeType: string;
  size: number;
}

/**
 * Abstract class (not interface) so it's a runtime value.
 * This avoids TS1272 with isolatedModules + emitDecoratorMetadata
 * while still allowing class-based providers to implement it.
 */
export abstract class IStorageDriver {
  abstract uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedFileResult>;

  abstract uploadPrivateFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedFileResult>;

  abstract getSignedReadUrl(fileKey: string, expiresIn?: number): Promise<string>;

  abstract deleteFile(fileKey: string): Promise<void>;
}
