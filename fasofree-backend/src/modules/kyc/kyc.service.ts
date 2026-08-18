import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IStorageDriver } from '../upload/interfaces/storage-driver.interface';
import { STORAGE_DRIVER } from '../upload/upload.module';
import {
  KycDocument,
  KycDocumentType,
  KycStatus,
} from './entities/kyc-document.entity';

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(KycDocument)
    private readonly documents: Repository<KycDocument>,
    private readonly dataSource: DataSource,
    @Inject(STORAGE_DRIVER)
    private readonly storage: IStorageDriver,
  ) {}

  async submit(
    ownerId: string,
    type: KycDocumentType,
    file: Express.Multer.File,
  ): Promise<KycDocument> {
    const upload = await this.storage.uploadPrivateFile(file, `kyc/${ownerId}`);
    const existing = await this.documents.findOne({ where: { ownerId, type } });
    if (existing) {
      const previousKey = existing.storageKey;
      existing.storageKey = upload.key;
      existing.mimeType = upload.mimeType;
      existing.size = upload.size;
      existing.status = KycStatus.PENDING;
      existing.reviewedBy = null;
      existing.rejectionReason = null;
      existing.reviewedAt = null;
      const saved = await this.documents.save(existing);
      await this.storage.deleteFile(previousKey);
      return saved;
    }
    return this.documents.save(
      this.documents.create({
        ownerId,
        type,
        storageKey: upload.key,
        mimeType: upload.mimeType,
        size: upload.size,
        status: KycStatus.PENDING,
        reviewedBy: null,
        rejectionReason: null,
        reviewedAt: null,
      }),
    );
  }

  async mine(ownerId: string): Promise<KycDocument[]> {
    return this.documents.find({
      where: { ownerId },
      order: { updatedAt: 'DESC' },
    });
  }

  async signedUrl(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<{ url: string }> {
    const document = await this.documents.findOne({ where: { id } });
    if (!document) throw new NotFoundException('Document KYC introuvable');
    if (!isAdmin && document.ownerId !== requesterId)
      throw new ForbiddenException('Accès refusé');
    return { url: await this.storage.getSignedReadUrl(document.storageKey) };
  }

  async pending(): Promise<KycDocument[]> {
    return this.documents.find({
      where: { status: KycStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  async review(
    id: string,
    adminId: string,
    status: KycStatus.APPROVED | KycStatus.REJECTED,
    reason?: string,
  ): Promise<KycDocument> {
    if (status === KycStatus.REJECTED && !reason?.trim())
      throw new BadRequestException('Le motif du rejet est obligatoire');
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const document = await runner.manager.findOne(KycDocument, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!document) throw new NotFoundException('Document KYC introuvable');
      if (document.status !== KycStatus.PENDING)
        throw new BadRequestException('Ce document a déjà été traité');
      document.status = status;
      document.reviewedBy = adminId;
      document.rejectionReason =
        status === KycStatus.REJECTED ? reason!.trim() : null;
      document.reviewedAt = new Date();
      const saved = await runner.manager.save(document);
      await runner.commitTransaction();
      return saved;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}
