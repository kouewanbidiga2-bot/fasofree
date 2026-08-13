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

  deleteFile(fileKey: string): Promise<void>;
}
