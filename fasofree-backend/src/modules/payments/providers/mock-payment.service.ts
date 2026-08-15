import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletService } from '../../wallets/wallet.service';
import { UserRole as WalletUserRole } from '../../wallets/entities/wallet.entity';
import {
  TransactionReason,
  TransactionType,
} from '../../wallets/entities/wallet-transaction.entity';
import { ReceiptsService } from '../../receipts/receipts.service';
import { OrdersService } from '../../orders/orders.service';
import { Order } from '../../orders/entities/order.entity';
import { TopupDto } from '../dto/topup.dto';

export interface MockTopupResponse {
  success: boolean;
  transactionId: string;
  newBalance: number;
  message: string;
}

export interface MockPayOrderResponse {
  success: boolean;
  transactionId: string;
  orderId: string;
  status: string;
  message: string;
}

/**
 * 🧪 Mock Payment Provider
 * Simule un paiement Mobile Money : crédite IMMÉDIATEMENT le wallet virtuel,
 * génère la référence MOCK-TX-XXXXX et le reçu client automatiquement.
 * Utilisé en développement / démo sans aucune clé LigdiCash.
 */
@Injectable()
export class MockPaymentService {
  private readonly logger = new Logger(MockPaymentService.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly receiptsService: ReceiptsService,
    private readonly ordersService: OrdersService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /** Génère une référence unique au format MOCK-TX-XXXXXXXXXX */
  private generateReference(): string {
    const time = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `MOCK-TX-${time.slice(-5)}${rand}`;
  }

  /**
   * 💰 Recharge simulée du portefeuille client.
   * Crédit ACID via WalletService (type DEPOSIT, statut COMPLETED) + reçu client.
   */
  async topup(clientId: string, dto: TopupDto): Promise<MockTopupResponse> {
    const amount = Number(dto.amount);
    const reference = this.generateReference();

    const { wallet, transaction } = await this.walletService.creditWallet(
      clientId,
      WalletUserRole.CUSTOMER,
      amount,
      TransactionReason.TOPUP,
      reference,
      `Recharge simulée portefeuille FasoFree de ${dto.customerName}`,
      TransactionType.DEPOSIT,
    );

    // 🧾 Génération automatique du reçu client
    await this.receiptsService.createTopupReceipt({
      clientUserId: clientId,
      amount,
      reference,
      walletTransactionId: transaction.id,
      balanceAfter: Number(wallet.balance),
      description: `Recharge de ${amount} FCFA via Mock Payment`,
    });

    this.logger.log(
      `[Mock Topup] +${amount} FCFA → wallet CUSTOMER ${clientId} (${reference})`,
    );

    return {
      success: true,
      transactionId: reference,
      newBalance: Number(wallet.balance),
      message: `Recharge simulée réussie ! +${amount} FCFA ajoutés à votre portefeuille.`,
    };
  }

  /**
   * 🛍️ Paiement simulé d'une commande (topup n'est pas requis).
   * Marque la commande PAID et déclenche le dispatch des livreurs.
   */
  async payOrder(
    orderId: string,
    clientId: string,
  ): Promise<MockPayOrderResponse> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }
    if (order.clientId !== clientId) {
      throw new ForbiddenException(
        'Cette commande ne vous appartient pas',
      );
    }

    const reference = this.generateReference();
    await this.ordersService.markAsPaidAndDispatch(orderId, reference);

    this.logger.log(
      `[Mock PayOrder] Commande ${orderId} payée et mise en livraison (${reference})`,
    );

    return {
      success: true,
      transactionId: reference,
      orderId,
      status: 'PAID',
      message: 'Commande payée et mise en livraison (simulation réussie)',
    };
  }
}
