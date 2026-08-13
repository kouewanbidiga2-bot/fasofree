import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class LigdiCashWebhookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;
  @ApiProperty({ example: '00' })
  @IsString()
  response_code: string; // '00' = Succès chez LigdiCash
  @ApiProperty()
  @IsString()
  response_text: string;
  @ApiProperty({ example: { orderId: 'uuid' } })
  @IsObject()
  custom_data: {
    orderId: string;
  };
  @ApiProperty({ enum: ['completed', 'failed', 'pending'] })
  @IsEnum(['completed', 'failed', 'pending'])
  status: 'completed' | 'failed' | 'pending';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operator_id?: string;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  transaction_id: string;
}
