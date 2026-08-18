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

  getSignedReadUrl(fileKey: string, expiresIn?: number): Promise<string>;

  deleteFile(fileKey: string): Promise<void>;
}
