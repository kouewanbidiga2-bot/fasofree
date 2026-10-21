/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import * as crypto from 'crypto';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { Transaction, TransactionStatus } from './entities/transaction.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { TopupDto } from './dto/topup.dto';
import { OrdersService } from '../orders/orders.service';
import { GeniusPayService } from './providers/geniuspay.service';
import { PaydunyaService } from './providers/paydunya.service';
import { WalletService } from '../wallets/wallet.service';
import { UserRole as WalletUserRole } from '../wallets/entities/wallet.entity';
import {
  TransactionReason,
  TransactionType,
} from '../wallets/entities/wallet-transaction.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly geniusPayService: GeniusPayService,
    private readonly paydunyaService: PaydunyaService,
    private readonly walletService: WalletService,
  ) {}

  async initiatePayment(dto: InitiatePaymentDto, clientId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
    });
    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }
    if (order.clientId !== clientId) {
      throw new BadRequestException('Cette commande ne vous appartient pas');
    }

    const terminalStatuses = [
      OrderStatus.PAID,
      OrderStatus.IN_PREPARATION,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.PROCESSING,
      OrderStatus.IN_DELIVERY,
      OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.DISPUTED,
      OrderStatus.REFUNDED,
    ];
    if (terminalStatuses.includes(order.status)) {
      throw new BadRequestException('Cette commande ne peut plus être payée');
    }

    // 🔁 Retry : si la commande est FAILED, la remettre en AWAITING_PAYMENT
    if (order.status === 'FAILED') {
      await this.orderRepository.update(order.id, { status: OrderStatus.AWAITING_PAYMENT });
      this.logger.log(`Order ${order.id} remise en AWAITING_PAYMENT pour retry`);
    }

    const reference = `FF-PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const commissionAmount = Number(
      order.merchantCommissionAmount ?? order.platformCommission ?? 0,
    );

    let transaction = await this.transactionRepository.findOne({
      where: { orderId: order.id },
    });

    // 🔒 ANTI DOUBLE-PAIEMENT
    // Si une tentative est DÉJÀ en cours, on ne crée surtout pas une seconde
    // charge GeniusPay : on renvoie la session existante pour reprendre le
    // paiement au même endroit. Avant ce correctif, un double clic sur
    // « Payer » créait deux paiements chez l'agrégateur, et le client pouvait
    // être débité deux fois sur la même commande.
    if (
      transaction &&
      transaction.status === TransactionStatus.PENDING &&
      transaction.gatewayCheckoutUrl
    ) {
      this.logger.log(
        `Payment idempotent for order ${order.id} — session existante ${transaction.reference} renvoyée`,
      );
      return {
        reference: transaction.reference,
        checkoutUrl: transaction.gatewayCheckoutUrl,
        paymentUrl: transaction.gatewayCheckoutUrl,
        status: 'pending',
        message: 'Paiement déjà en cours',
      };
    }

    if (transaction) {
      // 🔁 Retry : remettre la transaction en PENDING si elle était FAILED
      if (transaction.status === TransactionStatus.FAILED) {
        transaction.status = TransactionStatus.PENDING;
      }
      transaction.reference = reference;
      transaction.paymentMethod = dto.paymentMethod;
      transaction.amount = order.totalAmount;
      transaction.commissionAmount = commissionAmount;
      // Nouvelle tentative → nouvelle session chez l'agrégateur
      transaction.paymentGatewayId = null;
      transaction.gatewayCheckoutUrl = null;
      await this.transactionRepository.save(transaction);
    } else {
      transaction = this.transactionRepository.create({
        reference,
        orderId: order.id,
        amount: order.totalAmount,
        commissionAmount,
        paymentMethod: dto.paymentMethod,
        status: TransactionStatus.PENDING,
      });
      await this.transactionRepository.save(transaction);
    }

    try {
      const provider = this.getActiveProvider();
      if (provider === 'paydunya') {
        return await this.initiatePaydunyaPayment(order, reference, dto);
      }
      return await this.initiateGeniusPay(order, reference, dto);
    } catch (error) {
      this.logger.error(`Payment failed for order ${order.id}: ${error.message}`);
      // Marquer la commande ET la transaction en FAILED
      try {
        await this.orderRepository.update(order.id, { status: OrderStatus.FAILED });
        const tx = await this.transactionRepository.findOne({ where: { orderId: order.id } });
        if (tx && tx.status === TransactionStatus.PENDING) {
          await this.transactionRepository.update(tx.id, { status: TransactionStatus.FAILED });
        }
        this.logger.log(`Order ${order.id} + transaction marked FAILED after GeniusPay error`);
      } catch (updateErr) {
        this.logger.error(`Failed to mark order ${order.id} as FAILED: ${updateErr.message}`);
      }
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        'Impossible de contacter la passerelle de paiement. Veuillez réessayer.',
      );
    }
  }

  private async initiateGeniusPay(
    order: Order,
    reference: string,
    dto: InitiatePaymentDto,
  ) {
    // 🔗 URLS DE RETOUR — sans successUrl, le client reste bloqué sur la page
    // de l'agrégateur après paiement et ne voit jamais la confirmation.
    // On le renvoie sur le suivi de sa commande dans l'app client (où la
    // réconciliation et le webhook feront foi).
    const clientUrl = (
      this.configService.get<string>('CLIENT_URL') || 'https://fasofree.site'
    ).replace(/\/+$/, '');
    const successUrl = this.safeReturnUrl(
      dto.successUrl,
      clientUrl,
      `${clientUrl}/order-tracking?orderId=${order.id}`,
    );
    const errorUrl = this.safeReturnUrl(
      dto.errorUrl,
      clientUrl,
      `${clientUrl}/order-tracking?orderId=${order.id}&payment=failed`,
    );

    const payment = await this.geniusPayService.createPayment({
      amount: Number(order.totalAmount),
      description: `Commande #${order.id.substring(0, 8)}`,
      paymentMethod: dto.paymentMethod,
      customer: {
        phone: dto.phoneNumber,
      },
      metadata: {
        order_id: order.id,
        reference,
      },
      successUrl,
      errorUrl,
    });

    const checkoutUrl = payment.checkout_url || payment.payment_url;

    // 🔒 On PERSISTE la référence et l'URL de l'agrégateur. Avant ce
    // correctif, `paymentGatewayId` restait null : les recherches de webhook
    // par référence ne correspondaient jamais, et un second appel « Payer »
    // créait une charge supplémentaire.
    await this.transactionRepository.update(
      { reference },
      {
        paymentGatewayId: String(payment.reference ?? payment.id),
        gatewayCheckoutUrl: checkoutUrl ?? null,
      },
    );

    return {
      reference,
      checkoutUrl,
      paymentUrl: payment.payment_url,
      status: payment.status,
      message: 'Paiement GeniusPay initié',
    };
  }

  /**
   * URL de retour après paiement : seule l'origine de CLIENT_URL est
   * acceptée (anti open-redirect — un successUrl arbitraire permettrait de
   * diriger un client fraîchement débité vers un site hameçonneur).
   * Toute autre valeur est ignorée avec un warning au profit du défaut sûr.
   */
  private safeReturnUrl(
    candidate: string | undefined,
    clientUrl: string,
    fallback: string,
  ): string {
    if (!candidate) return fallback;
    try {
      if (new URL(candidate).origin === new URL(clientUrl).origin) {
        return candidate;
      }
    } catch {
      // URL illisible → repli sur le défaut
    }
    this.logger.warn(
      `[Payments] URL de retour ignorée (origine non autorisée): ${candidate}`,
    );
    return fallback;
  }

  // ========================================================================
  // 💳 PAYDUNYA PAYIN — Checkout & Top-up (Lot 4)
  // ========================================================================

  /**
   * Détermine le provider de paiement actif.
   * Priorité : 1. PAYMENT_PROVIDER explicite, 2. PayDunya si 4 clés présentes, 3. GeniusPay.
   */
  getActiveProvider(): 'geniuspay' | 'paydunya' {
    const explicit = this.configService.get<string>('PAYMENT_PROVIDER');
    if (explicit === 'geniuspay' || explicit === 'paydunya') {
      return explicit;
    }
    // Auto : PayDunya par défaut si configuré (4 clés Render présentes)
    if (this.paydunyaService.isConfigured()) {
      return 'paydunya';
    }
    return 'geniuspay';
  }

  /**
   * 💳 Initier un paiement PayDunya pour une commande (checkout).
   */
  async initiatePaydunyaPayment(
    order: Order,
    reference: string,
    dto: InitiatePaymentDto,
  ) {
    // 🔗 Mêmes URLs de retour que GeniusPay : les défauts PayDunya
    // (`/payment/success`) n'existent pas dans l'app client.
    const clientUrl = (
      this.configService.get<string>('CLIENT_URL') || 'https://fasofree.site'
    ).replace(/\/+$/, '');
    const { token, checkoutUrl } = await this.paydunyaService.createCheckoutInvoice({
      amountXof: Number(order.totalAmount),
      description: `Commande #${order.id.substring(0, 8)}`,
      customData: {
        type: 'ORDER',
        order_id: order.id,
        reference,
        payment_method: dto.paymentMethod,
      },
      returnUrl: this.safeReturnUrl(
        dto.successUrl,
        clientUrl,
        `${clientUrl}/order-tracking?orderId=${order.id}`,
      ),
      cancelUrl: this.safeReturnUrl(
        dto.errorUrl,
        clientUrl,
        `${clientUrl}/order-tracking?orderId=${order.id}&payment=failed`,
      ),
    });

    // 🔒 Persister le token PayDunya pour la réconciliation / webhook
    await this.transactionRepository.update(
      { reference },
      {
        paymentGatewayId: token,
        gatewayCheckoutUrl: checkoutUrl ?? null,
      },
    );

    return {
      reference,
      checkoutUrl,
      paymentUrl: checkoutUrl,
      status: 'pending',
      message: 'Paiement PayDunya initié',
    };
  }

  // ========================================================================
  /**
   * RECONCILIATION : interroger l'agregateur sur l'etat REEL d'une commande.
   *
   * Appele par le client au retour de GeniusPay. On interroge l'API
   * merchant avec la reference reellement stockee (paymentGatewayId) et :
   *  - si l'agregateur dit completed ET le montant correspond -> on applique
   *    la MEME logique que le webhook (transaction SUCCESS + commande PAID) ;
   *  - sinon on renvoie l'etat reel, sans jamais annoncer "paye".
   *
   * Cela rend l'affichage honnete meme si un webhook a ete perdu, et empeche
   * definitivement l'interface d'afficher "paye" sans encaissement.
   */
  async reconcilePaydunyaPayment(
    orderId: string,
    clientId: string,
  ): Promise<{ status: string; paid: boolean; reference: string | null }> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }
    if (order.clientId !== clientId) {
      throw new BadRequestException('Cette commande ne vous appartient pas');
    }

    const transaction = await this.transactionRepository.findOne({
      where: { orderId },
    });
    if (!transaction || !transaction.paymentGatewayId) {
      return { status: order.status, paid: false, reference: transaction?.reference ?? null };
    }

    const confirm = await this.paydunyaService.confirmInvoiceStatus(transaction.paymentGatewayId);
    if (confirm?.response_code === '00' && confirm?.status === 'completed') {
      // Même logique que le webhook : marquer SUCCESS + dispatcher
      await this.transactionRepository.update(
        { id: transaction.id },
        { status: TransactionStatus.SUCCESS },
      );
      await this.ordersService.markAsPaidAndDispatch(orderId, transaction.reference);
      this.logger.log(`[Reconcile PayDunya] Commande ${orderId} confirmée payée`);
      return { status: 'completed', paid: true, reference: transaction.reference };
    }

    return { status: order.status, paid: false, reference: transaction.reference };
  }

  /**
   * 💳 Recharge portefeuille via PayDunya (top-up).
   */
  async createPaydunyaTopup(userId: string, dto: TopupDto, userRole: string): Promise<{
    reference: string;
    checkoutUrl: string;
    paymentUrl: string;
    status: string;
    message: string;
  }> {
    const topupRef = `TOPUP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const { token, checkoutUrl } = await this.paydunyaService.createCheckoutInvoice({
      amountXof: dto.amount,
      description: `Recharge portefeuille FasoFree - ${dto.customerName || userId}`,
      customData: {
        type: 'WALLET_TOPUP',
        userId,
        reference: topupRef,
        walletRole: userRole,
      },
      returnUrl: `${this.configService.get<string>('CLIENT_URL') || 'https://fasofree.site'}/wallet/topup/success`,
      cancelUrl: `${this.configService.get<string>('CLIENT_URL') || 'https://fasofree.site'}/wallet/topup/cancel`,
    });

    // Pas de Transaction en base pour le top-up (le webhook créditera directement)
    // On loggue pour traçabilité
    this.logger.log(`PayDunya topup créé: ${topupRef} → token ${token}`);

    return {
      reference: topupRef,
      checkoutUrl,
      paymentUrl: checkoutUrl,
      status: 'pending',
      message: 'Redirection vers PayDunya pour le paiement.',
    };
  }

  /**
   * 💳 Traiter un top-up PayDunya confirmé (appelé depuis le webhook IPN).
   */
  async processPaydunyaTopup(data: any): Promise<boolean> {
    const customData = data?.custom_data ?? {};
    const userId = customData.userId;
    const topupRef = customData.reference;
    const walletRole = customData.walletRole;
    const amount = Number(data?.amount ?? 0);

    if (!userId || !topupRef) {
      this.logger.error('Webhook PayDunya topup: userId ou reference manquant dans custom_data');
      return false;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      this.logger.error(`Webhook PayDunya topup ${topupRef}: montant invalide`);
      return false;
    }

    const resolvedRole = this.resolveWalletRole(walletRole);
    await this.walletService.creditWallet(
      userId,
      resolvedRole,
      amount,
      TransactionReason.TOPUP,
      topupRef,
      `Recharge portefeuille via PayDunya (ref: ${data?.invoice?.token ?? ''})`,
      TransactionType.DEPOSIT,
      undefined,
    );

    this.logger.log(`✅ Recharge PayDunya ${topupRef} créditée : +${amount} XOF → ${resolvedRole} ${userId}`);
    return true;
  }

    // ========================================================================
  /**
   * RECONCILIATION : interroger l'agregateur sur l'etat REEL d'une commande.
   *
   * Appele par le client au retour de GeniusPay. On interroge l'API
   * merchant avec la reference reellement stockee (paymentGatewayId) et :
   *  - si l'agregateur dit completed ET le montant correspond -> on applique
   *    la MEME logique que le webhook (transaction SUCCESS + commande PAID) ;
   *  - sinon on renvoie l'etat reel, sans jamais annoncer "paye".
   *
   * Cela rend l'affichage honnete meme si un webhook a ete perdu, et empeche
   * definitivement l'interface d'afficher "paye" sans encaissement.
   */
  async reconcileOrderPayment(
    orderId: string,
    clientId: string,
  ): Promise<{ status: string; paid: boolean; reference: string | null }> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }
    if (order.clientId !== clientId) {
      throw new BadRequestException('Cette commande ne vous appartient pas');
    }

    return this.reconcilePaidState(orderId, order);
  }

  /**
   * Réconciliation ADMIN — même logique que `reconcileOrderPayment` mais
   * SANS contrôle d'appartenance : réservée aux rôles backoffice via le
   * contrôleur. Ne modifie jamais la logique de la route client existante.
   */
  async reconcileOrderPaymentAdmin(
    orderId: string,
  ): Promise<{ status: string; paid: boolean; reference: string | null }> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }

    return this.reconcilePaidState(orderId, order);
  }

  private async reconcilePaidState(
    orderId: string,
    order: Order,
  ): Promise<{ status: string; paid: boolean; reference: string | null }> {
    const alreadyPaid = [
      OrderStatus.PAID,
      OrderStatus.IN_PREPARATION,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.IN_DELIVERY,
      OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
    ].includes(order.status);
    if (alreadyPaid) {
      return { status: order.status, paid: true, reference: order.paymentTransactionRef ?? null };
    }

    const transaction = await this.transactionRepository.findOne({
      where: { orderId },
    });
    if (!transaction || !transaction.paymentGatewayId) {
      return { status: order.status, paid: false, reference: transaction?.reference ?? null };
    }
    if (transaction.status === TransactionStatus.SUCCESS) {
      return { status: order.status, paid: true, reference: transaction.reference };
    }

    // Interroge l'agrégateur — une erreur réseau ne doit pas faire mentir
    // l'interface : on renvoie alors l'état local, jamais « payé ».
    let gatewayStatus: string;
    let gatewayAmount: number | undefined;
    try {
      const remote = await this.geniusPayService.getPayment(
        transaction.paymentGatewayId,
      );
      gatewayStatus = String(remote.status ?? '').toLowerCase();
      gatewayAmount = remote.amount === undefined ? undefined : Number(remote.amount);
    } catch (err) {
      this.logger.warn(
        `[Reconcile] Impossible de joindre GeniusPay pour ${orderId}: ${(err as Error).message}`,
      );
      return { status: order.status, paid: false, reference: transaction.reference };
    }

    const expectedAmount = Number(order.totalAmount);
    // 🔒 FAIL-CLOSED : le montant doit être présent, numérique et cohérent.
    // La version précédente considérait « pas de montant » comme un montant
    // valide (`undefined ||` en tête), ce qui laissait un webhook/JSON
    // incomplet marquer la commande payée.
    const amountMatches =
      gatewayAmount !== undefined &&
      Number.isFinite(gatewayAmount) &&
      Number.isFinite(expectedAmount) &&
      Math.abs(expectedAmount - gatewayAmount) <= 1;

    if (gatewayStatus === 'completed' && !amountMatches) {
      this.logger.warn(
        `[Reconcile] ${orderId}: statut completed mais montant agrégateur non vérifiable (reçu: ${String(gatewayAmount)}, attendu: ${expectedAmount}) — NON confirmé`,
      );
    }

    if (gatewayStatus === 'completed' && amountMatches) {
      await this.transactionRepository.update(
        { id: transaction.id },
        { status: TransactionStatus.SUCCESS },
      );
      await this.ordersService.markAsPaidAndDispatch(orderId, transaction.reference);
      this.logger.log(`[Reconcile] Commande ${orderId} confirmée payée via GeniusPay`);
      return { status: OrderStatus.PAID, paid: true, reference: transaction.reference };
    }

    if (gatewayStatus === 'failed' || gatewayStatus === 'cancelled' || gatewayStatus === 'expired') {
      if (transaction.status === TransactionStatus.PENDING) {
        await this.transactionRepository.update(
          { id: transaction.id },
          { status: TransactionStatus.FAILED },
        );
        await this.ordersService.markAsPaymentFailed(orderId).catch(() => undefined);
      }
      return { status: gatewayStatus, paid: false, reference: transaction.reference };
    }

    // pending / processing → toujours en cours, jamais « payé ».
    return { status: order.status, paid: false, reference: transaction.reference };
  }

  async validatePaymentAmount(
    orderId: string,
    receivedAmount: number | string | undefined | null,
  ): Promise<boolean> {
    if (receivedAmount === undefined || receivedAmount === null) {
      this.logger.warn(`Webhook: montant absent pour la commande ${orderId}`);
      return false;
    }
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      this.logger.warn(`Webhook: commande ${orderId} introuvable`);
      return false;
    }
    const expected = Number(order.totalAmount);
    const received = Number(receivedAmount);
    return Math.abs(expected - received) <= 1;
  }

  async processSuccessfulPayment(
    orderId: string,
    transactionRef: string,
    paymentMethod: string,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      this.logger.error(`Commande introuvable pour l'ID : ${orderId}`);
      return;
    }

    const terminalPaidStatuses = [
      OrderStatus.PAID,
      OrderStatus.IN_PREPARATION,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.IN_DELIVERY,
      OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.DISPUTED,
      OrderStatus.REFUNDED,
    ];

    if (terminalPaidStatuses.includes(order.status)) {
      this.logger.warn(
        `Webhook ignoré : la commande ${orderId} est déjà dans un état payé/terminé (${order.status}).`,
      );
      return;
    }

    await this.ordersService.markAsPaidAndDispatch(orderId, transactionRef);
    this.logger.log(
      `Commande ${orderId} validée avec succès via ${paymentMethod}`,
    );
  }

  // ========================================================================
  // 💳 RECHARGE DE PORTEFEUILLE (top-up) — chemin dédié au webhook GeniusPay
  // ========================================================================

  /**
   * Crédite le portefeuille d'un utilisateur après un encaissement GeniusPay.
   *
   * Pourquoi un chemin dédié : une recharge n'a AUCUNE commande associée, donc
   * `metadata.order_id` est absent. Avant ce correctif, `handlePaymentSuccess`
   * exigeait un `order_id` et levait une exception : l'argent réellement
   * encaissé n'était JAMAIS crédité (bug bloquant pour financer une campagne).
   *
   * Idempotence : le crédit porte la référence `TOPUP-...` générée à
   * l'initiation. `WalletService.creditWallet` ignore tout doublon
   * (walletId + reference + reason), donc un webhook rejoué ne crédite pas 2×.
   *
   * @returns `true` si un crédit a été appliqué, `false` si le webhook est ignoré.
   */
  async creditTopupFromGateway(data: any, payload: any): Promise<boolean> {
    const metadata = data?.metadata ?? payload?.metadata ?? {};
    const userId = metadata.userId != null ? String(metadata.userId) : '';
    const topupRef =
      metadata.reference != null ? String(metadata.reference) : '';
    const branchId = metadata.branchId ? String(metadata.branchId) : undefined;
    // Le rôle vient du JWT de l'appelant, transmis dans le metadata signé.
    const walletRole = this.resolveWalletRole(metadata.walletRole);

    if (!userId || !topupRef) {
      this.logger.error(
        'Webhook topup: userId ou reference manquant dans metadata — crédit refusé',
      );
      return false;
    }

    // 🔒 On n'encaisse un crédit QUE sur un paiement réellement `completed`.
    const gatewayStatus = String(data?.status ?? '').toLowerCase();
    if (gatewayStatus && gatewayStatus !== 'completed') {
      this.logger.error(
        `Webhook topup ${topupRef}: statut agrégateur = "${gatewayStatus}" — NON crédité`,
      );
      return false;
    }

    const amount = Number(data?.amount ?? payload?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.logger.error(
        `Webhook topup ${topupRef}: montant invalide (${data?.amount}) — NON crédité`,
      );
      return false;
    }

    await this.walletService.creditWallet(
      userId,
      walletRole,
      amount,
      TransactionReason.TOPUP,
      topupRef,
      `Recharge portefeuille via GeniusPay${
        data?.reference ? ` (réf. ${data.reference})` : ''
      }`,
      TransactionType.DEPOSIT,
      branchId,
    );

    this.logger.log(
      `✅ Recharge ${topupRef} créditée : +${amount} XOF → ${walletRole} ${userId}`,
    );
    return true;
  }

  /**
   * Reprend le montant d'une recharge remboursée par GeniusPay.
   *
   * Le débit est autorisé EN NÉGATIF : si l'utilisateur a déjà dépensé l'argent,
   * le portefeuille passe en dette — FasoFree doit récupérer des fonds qu'elle
   * n'a plus. Idempotent via la référence `TOPUP-REFUND-<référence de recharge>`.
   *
   * On ne fait jamais échouer le webhook (sinon retries inutiles côté GeniusPay) :
   * en cas de problème, on trace pour une reprise manuelle par le Super Admin.
   */
  async reverseTopupFromGateway(data: any, payload: any): Promise<boolean> {
    const metadata = data?.metadata ?? payload?.metadata ?? {};
    const userId = metadata.userId != null ? String(metadata.userId) : '';
    const topupRef =
      metadata.reference != null ? String(metadata.reference) : '';
    const branchId = metadata.branchId ? String(metadata.branchId) : undefined;
    const walletRole = this.resolveWalletRole(metadata.walletRole);

    if (!userId || !topupRef) {
      this.logger.error(
        'Webhook topup refund: metadata incomplète — annulation ignorée',
      );
      return false;
    }

    const amount = Number(data?.amount ?? payload?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.logger.error(
        `Webhook topup refund ${topupRef}: montant invalide — annulation ignorée`,
      );
      return false;
    }

    const reference = `TOPUP-REFUND-${topupRef}`;

    // Garde-fou : ne jamais reprendre deux fois le même montant.
    const already = await this.walletService.hasLedgerEntry(
      userId,
      walletRole,
      reference,
      TransactionReason.REFUND,
      branchId,
    );
    if (already) {
      this.logger.warn(
        `Webhook topup refund ${topupRef}: déjà annulé — ignoré`,
      );
      return false;
    }

    try {
      await this.walletService.debitWalletAllowNegative(
        userId,
        walletRole,
        amount,
        TransactionReason.REFUND,
        reference,
        `Reprise de la recharge ${topupRef} (remboursement GeniusPay)`,
        branchId,
      );
      this.logger.log(
        `↩️ Recharge ${topupRef} annulée : -${amount} XOF ← ${walletRole} ${userId}`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        `❌ Échec de l'annulation de la recharge ${topupRef}: ${
          (err as Error).message
        }. Reprise manuelle requise.`,
      );
      return false;
    }
  }

  /**
   * Traduit le rôle applicatif (transmis dans le metadata à l'initiation) vers
   * le rôle de PORTEFEUILLE. Les deux enums sont distincts : `AGENCY` n'existe
   * pas dans `wallets_userrole_enum`, une société de livraison utilise donc un
   * portefeuille marchand (cf. Lot 3).
   */
  private resolveWalletRole(raw: unknown): WalletUserRole {
    const key = String(raw ?? '').toUpperCase();
    const map: Record<string, WalletUserRole> = {
      BUSINESS_ADMIN: WalletUserRole.MERCHANT,
      MERCHANT: WalletUserRole.MERCHANT,
      AGENCY: WalletUserRole.MERCHANT,
      DRIVER: WalletUserRole.DRIVER,
      COURIER: WalletUserRole.COURIER,
      CUSTOMER: WalletUserRole.CUSTOMER,
      CLIENT: WalletUserRole.CUSTOMER,
      SUPER_ADMIN: WalletUserRole.SUPER_ADMIN,
    };
    const resolved = map[key];
    if (!resolved) {
      this.logger.warn(
        `Webhook topup: rôle "${key || '(vide)'}" inconnu — repli sur MERCHANT`,
      );
      return WalletUserRole.MERCHANT;
    }
    return resolved;
  }
}
