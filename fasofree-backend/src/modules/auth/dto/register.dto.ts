import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { NotificationChannel } from '../../users/entities/user.entity';
import { IsBurkinaPhone } from '../validators/is-burkina-phone.validator';
import { IsDisposableEmail } from '../validators/disposable-email.validator';
import { AcceptedDocDto } from '../../legal/dto/legal.dto';

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

  // ⚖️ PACK LÉGAL — acceptation obligatoire des documents (CGU + confidentialité)
  // Optionnel au niveau DTO : la validation stricte (liste non vide + versions
  // courantes obligatoires) est faite par LegalService.assertOnboardingDocs à
  // l'appel — message d'erreur clair au lieu du 400 générique class-validator.
  @ApiProperty({
    description:
      "Documents légaux acceptés (version courante requise) — obligatoire. CGU (FR-CGU-001) et politique de confidentialité (FR-PRIV-002) minimum.",
    example: [
      { docCode: 'FR-CGU-001', docVersion: '1.0' },
      { docCode: 'FR-PRIV-002', docVersion: '1.0' },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcceptedDocDto)
  acceptedDocs?: AcceptedDocDto[];
}
