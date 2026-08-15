import { UserRole } from '../../users/entities/user-role.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

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
  @ApiPropertyOptional({ enum: UserRole, example: UserRole.CLIENT })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ example: 'AMINATA-7F3A' })
  @IsOptional()
  @IsString()
  referralCode?: string;
}
