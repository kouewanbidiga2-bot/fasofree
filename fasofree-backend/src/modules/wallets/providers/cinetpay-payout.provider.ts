import { Injectable, Logger } from '@nestjs/common';

export interface PayoutTransferResult {
  success: boolean;
  transactionId: string;
  message: string;
}

@Injectable()
export class CinetPayPayoutProvider {
  private readonly logger = new Logger(CinetPayPayoutProvider.name);

  async sendTransfer(
    transferId: string,
    amountFcfa: number,
    phoneNumber: string,
    provider: string,
  ): Promise<PayoutTransferResult> {
    return {
      success: true,
      transactionId: transferId,
      message: 'Transfert simulé avec succès',
    };
  }
}
