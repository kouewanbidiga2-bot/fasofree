import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { MobileMoneyProvider } from '../entities/user.entity';

export class UpdatePaymentInfoDto {
  @ApiPropertyOptional({ description: 'Numero Mobile Money pour les paiements/retraits', example: '+22670123456' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[0-9\s\-]{8,20}$/, { message: 'Numero Mobile Money invalide (format: +226XXXXXXXX)' })
  mobileMoneyNumber?: string;

  @ApiPropertyOptional({ enum: MobileMoneyProvider, description: 'Operateur Mobile Money' })
  @IsOptional()
  @IsEnum(MobileMoneyProvider, { message: 'Operateur invalide. Valeurs acceptees: WAVE, ORANGE_MONEY, MOOV_MONEY, TELECEL_MONEY' })
  mobileMoneyProvider?: MobileMoneyProvider;
}
