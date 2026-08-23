import { PaymentMethod } from '../entities/transaction.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ enum: PaymentMethod, description: 'Mode de paiement (normalisé en minuscules)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: '+22670000000' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{8,20}$/)
  phoneNumber?: string;
}
