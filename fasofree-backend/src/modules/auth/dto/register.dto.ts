import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { NotificationChannel } from '../../users/entities/user.entity';
import { IsBurkinaPhone } from '../validators/is-burkina-phone.validator';
import { IsDisposableEmail } from '../validators/disposable-email.validator';

export class RegisterDto {
  @ApiProperty({ example: 'Aminata Ouédraogo' })
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty({ example: 'aminata@fasofree.bf', format: 'email' })
  @IsEmail({}, { message: 'Adresse email invalide' })
  @IsDisposableEmail({ message: 'Les adresses email temporaires ne sont pas autorisées' })
  email: string;

  @ApiProperty({ example: '+22670000000' })
  @IsBurkinaPhone({ message: 'Numéro de téléphone Burkina Faso invalide. Format: +226XXXXXXXX ou 8 chiffres' })
  phone: string;

  @ApiProperty({ example: 'MotDePasseFort123!', format: 'password' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'AMINATA-7F3A' })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiPropertyOptional({ enum: NotificationChannel, example: 'EMAIL' })
  @IsOptional()
  @IsEnum(NotificationChannel)
  preferredNotificationChannel?: NotificationChannel;
}
