/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../entities/wallet.entity';

/**
 * 💰 Crédit MANUEL d'un portefeuille par le Super Admin.
 *
 * Cas d'usage : régulariser un encaissement fait hors plateforme (virement,
 * espèces, recharge GeniusPay en échec) ou débloquer un compte qui ne peut pas
 * encore se recharger seul. L'écriture est tracée au grand livre.
 *
 * ⚠️ `userRole` est le rôle du PORTEFEUILLE (`wallets_userrole_enum`), pas le
 * rôle applicatif : un commerce comme une agence se créditent en `MERCHANT`.
 */
export class AdminCreditWalletDto {
  @ApiProperty({
    example: '3f1c9d2e-0000-4000-8000-000000000000',
    description: "Identifiant de l'utilisateur (ou du commerce) à créditer",
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.MERCHANT,
    description:
      'Rôle du PORTEFEUILLE (MERCHANT pour un commerce ou une agence, DRIVER, COURIER, CUSTOMER, SUPER_ADMIN)',
  })
  @IsEnum(UserRole)
  userRole: UserRole;

  @ApiProperty({ example: 10000, minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Le montant doit être supérieur à 0' })
  amount: number;

  @ApiPropertyOptional({
    description:
      "ID de l'agence (portefeuille par agence). Si omis, crédite le portefeuille global.",
  })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    example: 'Virement Orange Money reçu le 18/10',
    description: "Motif lisible (repris dans le libellé de l'écriture)",
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  reason?: string;

  @ApiPropertyOptional({
    example: 'RECU-OM-2026-10-18-001',
    description:
      'Référence externe. Si fournie, elle rend le crédit IDEMPOTENT : un même rejeu ne crédite pas deux fois.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  reference?: string;
}
