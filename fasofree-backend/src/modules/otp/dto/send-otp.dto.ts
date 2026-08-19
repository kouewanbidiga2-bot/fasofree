import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ description: "ID de l'utilisateur" })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
