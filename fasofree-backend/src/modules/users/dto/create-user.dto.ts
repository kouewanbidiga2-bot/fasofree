import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { UserRole } from '../entities/user-role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'Awa Diallo' })
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty({ example: 'awa@fasofree.bf', format: 'email' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+22670000000' })
  @Matches(/^\+?[0-9]{8,20}$/)
  phone: string;

  @ApiProperty({ example: 'MotDePasseFort123!', format: 'password' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.SUPPORT })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
