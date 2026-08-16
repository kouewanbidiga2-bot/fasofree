import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RejectApplicationDto {
  @ApiProperty({ example: 'Pièce d\'identité illisible' })
  @IsString()
  @MinLength(2)
  reason: string;
}

export class ListApplicationsQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['MERCHANT', 'DRIVER'] })
  @IsOptional()
  @IsString()
  type?: string;
}
