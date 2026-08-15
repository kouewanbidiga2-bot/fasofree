import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class PayOrderDto {
  @ApiProperty({
    example: 'a1b2c3d4-0000-4000-8000-000000000001',
    description: 'ID de la commande à payer (simulation)',
  })
  @IsUUID()
  @IsString()
  @IsNotEmpty()
  orderId: string;
}
