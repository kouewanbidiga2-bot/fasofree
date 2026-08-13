import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePayinDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 5000, minimum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({ example: 'Aminata Ouédraogo' })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({ example: 'aminata@fasofree.bf', format: 'email' })
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  customerEmail: string;
}
