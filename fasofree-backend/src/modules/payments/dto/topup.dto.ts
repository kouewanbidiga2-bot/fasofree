import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class TopupDto {
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
