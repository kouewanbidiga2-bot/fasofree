/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

export interface UploadedFileResult {
  url: string;
  key: string;
  mimeType: string;
  size: number;
}

export interface IStorageDriver {
  uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedFileResult>;

  uploadPrivateFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedFileResult>;

  getSignedReadUrl(fileKey: string, expiresIn?: number, mimeType?: string): Promise<string>;

  deleteFile(fileKey: string): Promise<void>;
}
