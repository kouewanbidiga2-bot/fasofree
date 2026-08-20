import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { STORAGE_DRIVER } from '../upload/upload.tokens';
import {
  KycDocument,
  KycDocumentType,
  KycStatus,
} from './entities/kyc-document.entity';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    @InjectRepository(KycDocument)
    private readonly documents: Repository<KycDocument>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    @Inject(STORAGE_DRIVER)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly storage: any,
  ) {}

  async submit(
    ownerId: string,
    type: KycDocumentType,
    file: Express.Multer.File,
  ): Promise<KycDocument> {
    const upload = await this.storage.uploadPrivateFile(file, `kyc/${ownerId}`);

    // Reset user application status if previously rejected (resubmission)
    try {
      const user = await this.userRepository.findOne({ where: { id: ownerId } });
      if (user && user.applicationStatus === 'REJECTED') {
        user.applicationStatus = 'PENDING_APPROVAL';
        user.rejectionReason = null;
        user.reviewedBy = null;
        user.reviewedAt = null;
        await this.userRepository.save(user);
        this.logger.log(`[KYC] Resoumission : candidature ${ownerId} remise en PENDING_APPROVAL`);
      }
    } catch {
      // Non bloquant — le document KYC est soumis quand même
    }

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

  async pending(): Promise<any[]> {
    const raw = await this.documents
      .createQueryBuilder('doc')
      .leftJoinAndSelect('users', 'u', 'u.id = doc."ownerId"')
      .select([
        'doc.id as "id"',
        'doc."ownerId" as "ownerId"',
        'doc.type as "type"',
        'doc."storageKey" as "storageKey"',
        'doc."mimeType" as "mimeType"',
        'doc.size as "size"',
        'doc.status as "status"',
        'doc."createdAt" as "createdAt"',
        'u."fullName" as "ownerName"',
        'u.email as "ownerEmail"',
        'u.phone as "ownerPhone"',
        'u."applicationType" as "applicationType"',
        'u."applicationStatus" as "applicationStatus"',
        'u."vehicleType" as "vehicleType"',
      ])
      .where('doc.status = :status', { status: KycStatus.PENDING })
      .orderBy('doc."createdAt"', 'ASC')
      .getRawMany();
    return raw;
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

      if (status === KycStatus.APPROVED) {
        const ownerDocs = await this.documents.find({ where: { ownerId: document.ownerId } });
        const allApproved = ownerDocs.every(d => d.status === KycStatus.APPROVED);
        if (allApproved) {
          await this.userRepository.update(document.ownerId, { applicationStatus: 'KYC_APPROVED' });
        }
      }

      return saved;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}
