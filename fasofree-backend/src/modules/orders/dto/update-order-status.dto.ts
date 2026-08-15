import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'Nouveau statut à appliquer à la commande',
    enum: OrderStatus,
    example: OrderStatus.PAID,
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
