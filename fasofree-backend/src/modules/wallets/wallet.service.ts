import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Wallet, UserRole } from './entities/wallet.entity';
import {
  WalletTransaction,
  TransactionType,
  TransactionReason,
} from './entities/wallet-transaction.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { ConfigService } from '@nestjs/config';

// Définition propre pour le retour des requêtes SUM()
interface SumResult {
  sum: string | null;
}

// Éligibilité au payout (utilisé par le cron calculateAvailablePayouts)
interface PayoutEligibility {
  userId: string;
  userRole: UserRole;
  walletId: string;
  currentBalance: number;
  availableForPayout: number;
  periodRevenue: number;
  periodPaid: number;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly transactionRepository: Repository<WalletTransaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
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

  // ========================================================================
  // 💰 CRON JOB: Calcul des soldes disponibles pour les payouts (Commerçants & Livreurs)
  // S'exécute tous les jours à minuit
  // ========================================================================
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateAvailablePayouts(): Promise<void> {
    this.logger.log(
      '[Payout Cron] Début du calcul des soldes disponibles pour les payouts',
    );

    try {
      // 1. Calculer les soldes des commerçants
      const merchantWallets = await this.walletRepository.find({
        where: { userRole: UserRole.MERCHANT },
      });

      const merchantPayouts: PayoutEligibility[] = [];
      for (const wallet of merchantWallets) {
        // Calculer le chiffre d'affaires total (commandes COMPLETED)
        const totalRevenue = await this.orderRepository
          .createQueryBuilder('order')
          .select('SUM(order.merchantPayoutAmount)', 'sum')
          .where('order.businessId = :businessId', {
            businessId: wallet.userId,
          })
          .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
          .andWhere('order.createdAt >= :cutoff', {
            cutoff: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 derniers jours
          })
          .getRawOne<{ sum: string }>();

        const revenue = parseFloat(totalRevenue?.sum || '0');

        // Déduire les commissions déjà payées
        const paidCommissions = await this.transactionRepository
          .createQueryBuilder('tx')
          .select('SUM(tx.amount)', 'sum')
          .where('tx.walletId = :walletId', { walletId: wallet.id })
          .andWhere('tx.reason = :reason', { reason: TransactionReason.PAYOUT })
          .andWhere('tx.createdAt >= :cutoff', {
            cutoff: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          })
          .getRawOne<{ sum: string }>();

        const paid = parseFloat(paidCommissions?.sum || '0');
        const availableBalance = revenue - paid;

        if (availableBalance > 0) {
          merchantPayouts.push({
            userId: wallet.userId,
            userRole: UserRole.MERCHANT,
            walletId: wallet.id,
            currentBalance: Number(wallet.balance),
            availableForPayout: availableBalance,
            periodRevenue: revenue,
            periodPaid: paid,
          });
        }
      }

      // 2. Calculer les gains des livreurs
      const driverWallets = await this.walletRepository.find({
        where: { userRole: UserRole.DRIVER },
      });

      const driverPayouts: PayoutEligibility[] = [];
      for (const wallet of driverWallets) {
        // Calculer les frais de livraison gagnés
        const totalEarnings = await this.orderRepository
          .createQueryBuilder('order')
          .select('SUM(order.deliveryFee)', 'sum')
          .where('order.driverId = :driverId', { driverId: wallet.userId })
          .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
          .andWhere('order.createdAt >= :cutoff', {
            cutoff: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          })
          .getRawOne<{ sum: string }>();

        const earnings = parseFloat(totalEarnings?.sum || '0');

        // Déduire les payouts déjà effectués
        const paidEarnings = await this.transactionRepository
          .createQueryBuilder('tx')
          .select('SUM(tx.amount)', 'sum')
          .where('tx.walletId = :walletId', { walletId: wallet.id })
          .andWhere('tx.reason = :reason', { reason: TransactionReason.PAYOUT })
          .andWhere('tx.createdAt >= :cutoff', {
            cutoff: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          })
          .getRawOne<{ sum: string }>();

        const paid = parseFloat(paidEarnings?.sum || '0');
        const availableBalance = earnings - paid;

        if (availableBalance > 0) {
          driverPayouts.push({
            userId: wallet.userId,
            userRole: UserRole.DRIVER,
            walletId: wallet.id,
            currentBalance: Number(wallet.balance),
            availableForPayout: availableBalance,
            periodRevenue: earnings,
            periodPaid: paid,
          });
        }
      }

      this.logger.log(
        `[Payout Cron] ${merchantPayouts.length} commerçant(s) éligible(s) pour payout - Total: ${merchantPayouts.reduce((sum, p) => sum + p.availableForPayout, 0).toLocaleString()} FCFA`,
      );
      this.logger.log(
        `[Payout Cron] ${driverPayouts.length} livreur(s) éligible(s) pour payout - Total: ${driverPayouts.reduce((sum, p) => sum + p.availableForPayout, 0).toLocaleString()} FCFA`,
      );

      // 3. Enregistrer les demandes de payout dans une table (à créer) ou logger pour le moment
      // TODO: Créer une entité PayoutRequest pour tracker les demandes
      const minPayoutAmount = this.configService.get<number>(
        'MIN_PAYOUT_AMOUNT',
        5000,
      );

      const eligibleMerchantPayouts = merchantPayouts.filter(
        (p) => p.availableForPayout >= minPayoutAmount,
      );
      const eligibleDriverPayouts = driverPayouts.filter(
        (p) => p.availableForPayout >= minPayoutAmount,
      );

      this.logger.log(
        `[Payout Cron] ${eligibleMerchantPayouts.length} commerçant(s) au-dessus du seuil (${minPayoutAmount} FCFA)`,
      );
      this.logger.log(
        `[Payout Cron] ${eligibleDriverPayouts.length} livreur(s) au-dessus du seuil (${minPayoutAmount} FCFA)`,
      );

      // Log des payouts éligibles pour approbation admin
      eligibleMerchantPayouts.forEach((payout) => {
        this.logger.log(
          `[Payout Request] Commerçant ${payout.userId}: ${payout.availableForPayout.toLocaleString()} FCFA disponible`,
        );
      });

      eligibleDriverPayouts.forEach((payout) => {
        this.logger.log(
          `[Payout Request] Livreur ${payout.userId}: ${payout.availableForPayout.toLocaleString()} FCFA disponible`,
        );
      });
    } catch (error) {
      this.logger.error(
        `[Payout Cron Error] Erreur lors du calcul des payouts: ${error.message}`,
      );
    }
  }

  // ========================================================================
  // 💰 Générer un ordre de virement manuel (pour approbation Super Admin)
  // ========================================================================
  async generatePayoutRequest(
    userId: string,
    userRole: UserRole,
  ): Promise<{ success: boolean; amount: number; message: string }> {
    const wallet = await this.walletRepository.findOne({
      where: { userId, userRole },
    });

    if (!wallet) {
      throw new NotFoundException('Portefeuille introuvable');
    }

    const availableBalance = Number(wallet.balance);
    const minPayoutAmount = this.configService.get<number>(
      'MIN_PAYOUT_AMOUNT',
      5000,
    );

    if (availableBalance < minPayoutAmount) {
      return {
        success: false,
        amount: availableBalance,
        message: `Solde insuffisant. Minimum requis: ${minPayoutAmount} FCFA`,
      };
    }

    // TODO: Créer une entité PayoutRequest et l'enregistrer
    this.logger.log(
      `[Payout Request] Demande de payout pour ${userRole} ${userId}: ${availableBalance.toLocaleString()} FCFA`,
    );

    return {
      success: true,
      amount: availableBalance,
      message:
        "Demande de payout enregistrée. En attente d'approbation Super Admin.",
    };
  }
}
