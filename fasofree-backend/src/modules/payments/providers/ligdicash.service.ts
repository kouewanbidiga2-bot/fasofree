import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CreatePayinDto } from '../dto/create-payin.dto';
import { TopupDto } from '../dto/topup.dto';
import { LigdiCashWebhookDto } from '../dto/ligdicash-webhook.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

export interface PayinResponse {
  paymentUrl: string;
  token: string;
}

@Injectable()
export class LigdiCashService {
  private readonly logger = new Logger(LigdiCashService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly authToken: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {
    // 🌐 Sélection Sandbox / Production via PAYMENT_ENV (bascule globale)
    // Rétro-compatible : LIGDICASH_IS_PROD (booléen) encore supporté.
    const paymentEnv = this.configService.get<string>('PAYMENT_ENV', 'sandbox');
    const isProd =
      paymentEnv === 'production' ||
      this.configService.get<boolean>('LIGDICASH_IS_PROD', false);
    this.baseUrl = isProd
      ? 'https://api.ligdicash.com/pay/v2'
      : 'https://api-sandbox.ligdicash.com/pay/v2';

    this.apiKey = this.configService.get<string>('LIGDICASH_API_KEY', '');
    this.authToken = this.configService.get<string>('LIGDICASH_AUTH_TOKEN', '');
  }

  /**
   * 💳 Initialise une demande de paiement (Payin)
   */
  async initiatePayin(
    dto: CreatePayinDto,
    clientId: string,
  ): Promise<PayinResponse> {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.clientId !== clientId)
      throw new ForbiddenException('Cette commande ne vous appartient pas');
    if (Number(order.totalAmount) !== Number(dto.amount)) {
      throw new BadRequestException(
        'Le montant de paiement ne correspond pas à la commande',
      );
    }
    const webhookUrl = this.configService.get<string>(
      'LIGDICASH_WEBHOOK_URL',
      'https://api.fasofree.com/api/v1/payments/ligdicash/webhook',
    );

    const payload = {
      commande: {
        invoice: {
          items: [
            {
              name: `Commande FasoFree #${dto.orderId.substring(0, 8)}`,
              description: 'Livraison & Repas FasoFree',
              quantity: 1,
              unit_price: Number(order.totalAmount),
              total_price: Number(order.totalAmount),
            },
          ],
          total_amount: Number(order.totalAmount),
          devise: 'XOF',
          description: `Paiement commande FasoFree #${dto.orderId}`,
          customer_firstname: dto.customerName,
          customer_lastname: '',
          customer_email: dto.customerEmail,
        },
        store: {
          name: 'FasoFree',
          website_url: 'https://fasofree.com',
        },
        actions: {
          cancel_url: `https://fasofree.com/orders/${dto.orderId}/cancel`,
          return_url: `https://fasofree.com/orders/${dto.orderId}/success`,
          callback_url: webhookUrl,
        },
        custom_data: {
          orderId: dto.orderId,
        },
      },
    };

    return this.createPayin(payload);
  }

  /**
   * 💰 Recharge du portefeuille virtuel du client (deposit Mobile Money).
   * Le webhook créditera automatiquement le wallet CUSTOMER via
   * `TransactionReason.TOPUP` (voir LigdiCashController.handleWebhook).
   */
  async initiateTopup(clientId: string, dto: TopupDto): Promise<PayinResponse> {
    const webhookUrl = this.configService.get<string>(
      'LIGDICASH_WEBHOOK_URL',
      'https://api.fasofree.com/api/v1/payments/ligdicash/webhook',
    );

    const payload = {
      commande: {
        invoice: {
          items: [
            {
              name: 'Recharge portefeuille FasoFree',
              description: 'Recharge Wallet Mobile Money (Orange/Moov)',
              quantity: 1,
              unit_price: Number(dto.amount),
              total_price: Number(dto.amount),
            },
          ],
          total_amount: Number(dto.amount),
          devise: 'XOF',
          description: `Recharge portefeuille FasoFree de ${dto.customerName}`,
          customer_firstname: dto.customerName,
          customer_lastname: '',
          customer_email: dto.customerEmail,
        },
        store: {
          name: 'FasoFree',
          website_url: 'https://fasofree.com',
        },
        actions: {
          cancel_url: 'https://fasofree.com/wallet',
          return_url: 'https://fasofree.com/wallet/success',
          callback_url: webhookUrl,
        },
        custom_data: {
          purpose: 'TOPUP',
          clientId,
          amount: Number(dto.amount),
        },
      },
    };

    this.logger.log(
      `[LigdiCash Topup] Facture de recharge ${dto.amount} FCFA pour ${clientId}`,
    );

    return this.createPayin(payload);
  }

  /**
   * 🚀 Envoie la facture à LigdiCash et retourne l'URL de paiement + token.
   */
  private async createPayin(
    payload: Record<string, unknown>,
  ): Promise<PayinResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/payin/invoice`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.authToken}`,
            Apikey: this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data && response.data.response_code === '00') {
        return {
          paymentUrl: response.data.response_text, // URL de redirection
          token: response.data.token,
        };
      }

      throw new BadRequestException(
        `Erreur LigdiCash: ${response.data?.response_text || 'Inconnue'}`,
      );
    } catch (error) {
      this.logger.error(
        `[LigdiCash Error] Échec de création du Payin: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        "Impossible d'initialiser le paiement LigdiCash",
      );
    }
  }
  /**
   * Récupère les soldes réels des comptes LigdiCash (Payin / Payout)
   */
  async getAccountBalances(): Promise<{
    payinBalance: number;
    payoutBalance: number;
  }> {
    try {
      this.logger.log('[LigdiCash] Appel API pour récupération des soldes...');

      // TODO: Remplacer par l'appel HTTP réel vers l'API LigdiCash quand tu auras leurs accès Prod
      // const response = await axios.get(`${this.apiUrl}/balances`, { headers: this.getHeaders() });
      // return response.data;

      // Mock robuste pour l'environnement de développement / test
      return {
        payinBalance: 1500000,
        payoutBalance: 500000,
      };
    } catch (error) {
      this.logger.error(
        `Échec de récupération des soldes LigdiCash: ${error.message}`,
      );
      // On retourne 0 en cas de crash de l'API externe pour ne pas bloquer le système interne
      return { payinBalance: 0, payoutBalance: 0 };
    }
  }

  /**
   * 🔍 Vérification active du statut d'un paiement (Double-Check de sécurité)
   */
  async verifyTransactionStatus(token: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/payin/status?token=${token}`,
        {
          headers: {
            Authorization: `Bearer ${this.authToken}`,
            Apikey: this.apiKey,
          },
        },
      );

      return (
        response.data?.status === 'completed' &&
        response.data?.response_code === '00'
      );
    } catch (error) {
      this.logger.error(
        `[LigdiCash Verification Error] Token: ${token}`,
        error.stack,
      );
      return false;
    }
  }
}
