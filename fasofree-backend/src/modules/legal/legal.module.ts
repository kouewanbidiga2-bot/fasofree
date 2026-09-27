import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LegalDocument } from './entities/legal-document.entity';
import { ContractAcceptance } from './entities/contract-acceptance.entity';
import { LegalService } from './legal.service';
import { LegalController } from './legal.controller';
import { OtpModule } from '../otp/otp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LegalDocument, ContractAcceptance]),
    // OTP dédié à la signature de contrat (sendContractOtp / verifyContractOtp).
    OtpModule,
  ],
  controllers: [LegalController],
  providers: [LegalService],
  exports: [LegalService],
})
export class LegalModule {}