import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Wallet, UserRole } from './entities/wallet.entity';
import {
  WalletTransaction,
  TransactionType,
  TransactionReason,
} from './entities/wallet-transaction.entity';

// Définition propre pour le retour des requêtes SUM()
interface SumResult {
  sum: string | null;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly transactionRepository: Repository<WalletTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Obtient ou crée automatiquement le portefeuille d'un utilisateur
   */
  async getOrCreateWallet(userId: string, userRole: UserRole): Promise<Wallet> {
    let wallet = await this.walletRepository.findOne({
      where: { userId, userRole },
    });

    if (!wallet) {
      wallet = this.walletRepository.create({
        userId,
        userRole,
        balance: 0,
      });
      await this.walletRepository.save(wallet);
      this.logger.log(
        `[Wallet Created] NOUVEAU portefeuille pour ${userRole} ${userId}`,
      );
    }

    return wallet;
  }

  /**
   * Crédite le solde d'un portefeuille de manière atomique (ACID)
   */
  async creditWallet(
    userId: string,
    userRole: UserRole,
    amount: number,
    reason: TransactionReason,
    reference?: string,
    description?: string,
  ): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
    if (amount <= 0) {
      throw new BadRequestException('Le montant doit être supérieur à 0');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Récupérer le wallet avec verrouillage écriture
      let wallet = await queryRunner.manager.findOne(Wallet, {
        where: { userId, userRole },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        wallet = queryRunner.manager.create(Wallet, {
          userId,
          userRole,
          balance: 0,
        });
        await queryRunner.manager.save(wallet);
      }

      // 2. Calculer le nouveau solde
      wallet.balance = Number(wallet.balance) + Number(amount);
      await queryRunner.manager.save(wallet);

      // 3. Enregistrer l'écriture au grand livre (Ledger)
      const transaction = queryRunner.manager.create(WalletTransaction, {
        walletId: wallet.id,
        type: TransactionType.CREDIT,
        reason,
        amount,
        balanceAfter: wallet.balance,
        reference,
        description,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();
      this.logger.log(
        `[Wallet Credit] +${amount} XOF pour ${userRole} ${userId}. Nouveau solde: ${wallet.balance}`,
      );

      return { wallet, transaction };
    } catch (error: unknown) {
      // Annulation OBLIGATOIRE de la transaction en cas d'erreur
      await queryRunner.rollbackTransaction();

      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`[Wallet Credit Error] ${errorMessage}`);

      // Si c'est déjà une exception HTTP NestJS, on la relance telle quelle
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        'Une erreur inattendue est survenue lors du crédit',
      );
    } finally {
      // Libération OBLIGATOIRE du queryRunner pour éviter les fuites de mémoire
      await queryRunner.release();
    }
  }

  /**
   * Débite le solde d'un portefeuille (avec vérification de solde suffisant)
   */
  async debitWallet(
    userId: string,
    userRole: UserRole,
    amount: number,
    reason: TransactionReason,
    reference?: string,
    description?: string,
  ): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
    if (amount <= 0) {
      throw new BadRequestException('Le montant doit être supérieur à 0');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { userId, userRole },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        throw new NotFoundException(
          `Portefeuille introuvable pour ${userRole} ${userId}`,
        );
      }

      if (Number(wallet.balance) < Number(amount)) {
        throw new BadRequestException(
          `Solde insuffisant. Solde actuel: ${wallet.balance} XOF, Requis: ${amount} XOF`,
        );
      }

      wallet.balance = Number(wallet.balance) - Number(amount);
      await queryRunner.manager.save(wallet);

      const transaction = queryRunner.manager.create(WalletTransaction, {
        walletId: wallet.id,
        type: TransactionType.DEBIT,
        reason,
        amount,
        balanceAfter: wallet.balance,
        reference,
        description,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();
      this.logger.log(
        `[Wallet Debit] -${amount} XOF pour ${userRole} ${userId}. Nouveau solde: ${wallet.balance}`,
      );

      return { wallet, transaction };
    } catch (error: unknown) {
      // Annulation OBLIGATOIRE de la transaction en cas d'erreur
      await queryRunner.rollbackTransaction();

      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`[Wallet Debit Error] ${errorMessage}`);

      // On relance l'erreur originale si c'est une exception NestJS (ex: NotFound ou BadRequest)
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        'Une erreur inattendue est survenue lors du débit',
      );
    } finally {
      // Libération OBLIGATOIRE du queryRunner pour éviter les fuites de mémoire
      await queryRunner.release();
    }
  }

  /**
   * Méthode requise par FinancialMonitoringService
   * Calcule le total du passif virtuel (la somme de l'argent dû à tous les livreurs et marchands)
   */
  async getTotalVirtualLiabilities(): Promise<{
    driversTotal: number;
    merchantsTotal: number;
    grandTotal: number;
  }> {
    // Utilisation d'un typage strict avec getRawOne<SumResult>()
    const driversResult = await this.walletRepository
      .createQueryBuilder('wallet')
      .select('SUM(wallet.balance)', 'sum')
      .where('wallet.userRole = :role', { role: UserRole.DRIVER })
      .getRawOne<SumResult>();

    const merchantsResult = await this.walletRepository
      .createQueryBuilder('wallet')
      .select('SUM(wallet.balance)', 'sum')
      .where('wallet.userRole = :role', { role: UserRole.MERCHANT })
      .getRawOne<SumResult>();

    // Nullish coalescing operator (??) est plus sûr que (||) pour gérer le cas où la table est vide
    const driversTotal = parseFloat(driversResult?.sum ?? '0');
    const merchantsTotal = parseFloat(merchantsResult?.sum ?? '0');

    return {
      driversTotal,
      merchantsTotal,
      grandTotal: driversTotal + merchantsTotal,
    };
  }

  /**
   * Récupère l'historique des transactions
   */
  async getTransactionHistory(
    walletId: string,
    limit = 20,
  ): Promise<WalletTransaction[]> {
    return this.transactionRepository.find({
      where: { walletId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getTransactionHistoryForUser(
    walletId: string,
    userId: string,
    isSuperAdmin: boolean,
    limit = 20,
  ): Promise<WalletTransaction[]> {
    const wallet = await this.walletRepository.findOne({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Portefeuille introuvable');
    }

    if (!isSuperAdmin && wallet.userId !== userId) {
      throw new BadRequestException('Accès non autorisé à ce portefeuille');
    }

    return this.getTransactionHistory(
      walletId,
      Math.min(Math.max(limit, 1), 100),
    );
  }
}
