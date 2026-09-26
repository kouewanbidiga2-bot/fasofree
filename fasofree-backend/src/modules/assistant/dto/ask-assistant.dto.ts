import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AskAssistantDto {
  @ApiProperty({
    example: 'Quel plat me conseilles-tu ?',
    description: "Question posée à l'assistant",
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(2)
  @MaxLength(500)
  @IsNotEmpty()
  question: string;

  @ApiPropertyOptional({
    example: '3d1f6d8e-62c0-4c7a-9f88-2d0b0c8a91e4',
    description:
      'ID du restaurant actuellement affiché — permet des conseils sur son menu réel',
  })
  @IsOptional()
  @IsUUID()
  businessId?: string;
}