import {
  IsNumber,
  IsEnum,
  IsPhoneNumber,
  Min,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum PayoutProviderEnum {
  ORANGE_MONEY = 'ORANGE_MONEY',
  MOOV_MONEY = 'MOOV_MONEY',
  WAVE = 'WAVE',
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
  })
  @IsEnum(PayoutProviderEnum)
  provider: PayoutProviderEnum;

  @ApiProperty({
    example: '+22670000000',
    description: 'Numéro Mobile Money de réception',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}
