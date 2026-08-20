import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDisputeDto {
  @ApiProperty({
    example: 'Commande non reçue malgré la confirmation du livreur.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;

  @ApiProperty({
    example: 'MonMotDePasse123',
    description: 'Mot de passe actuel pour confirmer la soumission du litige.',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Clés S3 déjà téléversées via le module Upload.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  attachments?: string[];
}
