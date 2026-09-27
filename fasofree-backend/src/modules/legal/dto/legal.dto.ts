import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

/** Document légal + version acceptés (protocole README §5). */
export class AcceptedDocDto {
  @ApiProperty({ example: 'FR-CGU-001', description: 'Code du document (FR-CGU-001, FR-PRIV-002…)' })
  @IsString()
  @Matches(/^[A-Z]{2}-[A-Z0-9-]{2,17}$/, {
    message: 'docCode invalide (format attendu : FR-XXXX-XXX)',
  })
  docCode: string;

  @ApiProperty({ example: '1.0', description: 'Version actuelle du document' })
  @IsString()
  docVersion: string;
}

/** Corps de POST /legal/acceptances (enregistrement d'une acceptation). */
export class RecordAcceptanceDto {
  @ApiProperty({ example: 'FR-CGU-001' })
  @IsString()
  @Matches(/^[A-Z]{2}-[A-Z0-9-]{2,17}$/, {
    message: 'docCode invalide (format attendu : FR-XXXX-XXX)',
  })
  docCode: string;

  @ApiProperty({ example: '1.0' })
  @IsString()
  docVersion: string;

  @ApiPropertyOptional({ enum: ['case-a-cocher'], example: 'case-a-cocher' })
  @IsOptional()
  @IsIn(['case-a-cocher'])
  mechanism?: string;

  @ApiPropertyOptional({ example: 'web', description: 'Contexte : web, mobile, dashboard…' })
  @IsOptional()
  @IsString()
  source?: string;
}

/** Corps de POST /legal/contracts/sign (code OTP de signature). */
export class SignContractDto {
  @ApiProperty({ example: '123456', description: 'Code OTP à 6 chiffres reçu par email/SMS' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code OTP attendu : 6 chiffres' })
  code: string;
}