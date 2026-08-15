import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'client@fasofree.bf', format: 'email' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MotDePasseFort123!', format: 'password' })
  @IsString()
  @MinLength(8)
  password: string;
}
