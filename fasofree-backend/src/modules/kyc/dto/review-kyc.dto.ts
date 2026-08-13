import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewKycDto {
  @ApiPropertyOptional({ description: 'Obligatoire en cas de rejet.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
