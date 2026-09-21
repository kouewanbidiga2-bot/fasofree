import {
  IsNumber,
  IsEnum,
  IsPhoneNumber,
  Min,
  IsString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PayoutProviderEnum {
  ORANGE_MONEY = 'ORANGE_MONEY',
  MOOV_MONEY = 'MOOV_MONEY',
  WAVE = 'WAVE',
}

export class ApprovePayoutDto {
  @ApiProperty({
    example: '+22670000000',
    description: 'Numéro Mobile Money où effectuer le transfert manuel',
  })
  @IsPhoneNumber('BF', { message: 'Numéro Mobile Money burkinabè invalide' })
  phoneNumber: string;

  @ApiPropertyOptional({
    enum: PayoutProviderEnum,
    example: PayoutProviderEnum.ORANGE_MONEY,
    description: 'Opérateur Mobile Money utilisé pour le transfert',
  })
  @IsEnum(PayoutProviderEnum)
  @IsOptional()
  provider?: PayoutProviderEnum;
}

export class RequestWithdrawalDto {
  @ApiProperty({
    example: 5000,
    description: 'Montant à retirer en FCFA (Minimum 1000 FCFA)',
  })
  @IsNumber()
  @Min(1000, { message: 'Le montant minimum de retrait est de 1000 FCFA.' })
  amountFcfa: number;

  @ApiProperty({
    enum: PayoutProviderEnum,
    example: PayoutProviderEnum.ORANGE_MONEY,
    description: 'Opérateur Mobile Money de réception (virement exécuté via GeniusPay)',
  })
  @IsEnum(PayoutProviderEnum)
  provider: PayoutProviderEnum;

  @ApiProperty({
    example: '+22670000000',
    description: 'Numéro Mobile Money de réception',
  })
  @IsPhoneNumber('BF', { message: 'Numéro Mobile Money burkinabè invalide' })
  phoneNumber: string;

  @ApiPropertyOptional({
    description: 'ID de l\'agence (wallet par agence). Si omis, débite le wallet global.',
  })
  @IsString()
  @IsOptional()
  branchId?: string;
}
