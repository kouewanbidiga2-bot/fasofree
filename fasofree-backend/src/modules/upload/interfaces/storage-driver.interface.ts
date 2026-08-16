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

  /** Upload d'un document privé (KYC) : URL publique vide, clé de stockage renvoyée */
  uploadPrivateFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedFileResult>;

  /** URL signée (S3) ou locale (/uploads/...) permettant de consulter un document */
  getSignedReadUrl(fileKey: string, expiresIn?: number): Promise<string>;

  deleteFile(fileKey: string): Promise<void>;
}
