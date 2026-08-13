import { PaymentMethod } from '../entities/transaction.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  orderId: string;
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
  @ApiPropertyOptional({ example: '+22670000000' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{8,20}$/)
  phoneNumber?: string; // Requis pour Orange / Moov Money (Push USSD)
}
