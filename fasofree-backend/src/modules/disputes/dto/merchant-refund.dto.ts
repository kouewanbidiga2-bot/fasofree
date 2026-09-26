import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO du remboursement décidé par le gérant du commerce.
 * `note` est écrit dans merchantNote (colonne dédiée au marchand) — jamais
 * dans adminNote, réservée à l'audit de l'administration.
 */
export class MerchantRefundDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
