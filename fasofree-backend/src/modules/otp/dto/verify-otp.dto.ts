import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ description: "ID de l'utilisateur" })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Code OTP à 6 chiffres', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'Le code OTP doit contenir exactement 6 chiffres' })
  code: string;
}
