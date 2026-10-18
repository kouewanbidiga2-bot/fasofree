import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class TopupDto {
  @ApiProperty({ example: 5000, minimum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({ example: 'Aminata Ouédraogo' })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({ example: 'aminata@fasofree.bf', format: 'email' })
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  customerEmail: string;

  /**
   * 🏷️ Agence à créditer (portefeuille par agence). Si omis, la recharge
   * crédite le portefeuille GLOBAL du compte. Le crédit ne porte jamais que
   * sur le portefeuille de l'appelant (l'`userId` vient du JWT).
   */
  @ApiPropertyOptional({
    description:
      "ID de l'agence à créditer (portefeuille par agence). Si omis, crédite le portefeuille global.",
  })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ example: 'paydunya', enum: ['geniuspay', 'paydunya'], description: 'Provider de paiement (défaut: auto)' })
  @IsOptional()
  @IsString()
  provider?: 'geniuspay' | 'paydunya';
}