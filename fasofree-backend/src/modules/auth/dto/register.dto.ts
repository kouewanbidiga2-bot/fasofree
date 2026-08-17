import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { NotificationChannel } from '../../users/entities/user.entity';

export class RegisterDto {
  @ApiProperty({ example: 'Aminata Ouédraogo' })
  @IsString()
  @MinLength(2)
  fullName: string;
  @ApiProperty({ example: 'aminata@fasofree.bf', format: 'email' })
  @IsEmail()
  email: string;
  @ApiProperty({ example: '+22670000000' })
  @Matches(/^\+?[0-9]{8,20}$/)
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
