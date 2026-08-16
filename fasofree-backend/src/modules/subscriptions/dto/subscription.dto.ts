import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { SubscriptionSubjectType } from '../entities/subscription.entity';

export class CreatePlanDto {
  @ApiProperty({ example: 'VIP', description: 'Code unique du forfait (majuscules)' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'FasoFree Pass VIP' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: SubscriptionSubjectType, example: SubscriptionSubjectType.CUSTOMER })
  @IsEnum(SubscriptionSubjectType)
  subjectType: SubscriptionSubjectType;

  @ApiProperty({ example: 2500 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceFcfa: number;

  @ApiProperty({ example: 30, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  durationDays?: number;

  @ApiProperty({ example: 0.015, required: false, description: 'Taux de commission préférentiel (ex: 0.015 = 1.5%), null = standard' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  commissionRate?: number | null;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  freeServiceFee?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  freeDelivery?: boolean;

  @ApiProperty({ required: false, default: 0, description: 'Seuil de panier pour livraison gratuite' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  freeDeliveryMinSubtotal?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}

export class AssignSubscriptionDto {
  @ApiProperty({ enum: SubscriptionSubjectType, example: SubscriptionSubjectType.MERCHANT })
  @IsEnum(SubscriptionSubjectType)
  subjectType: SubscriptionSubjectType;

  @ApiProperty({ description: 'ID du Business (commerçant) ou du User (client)' })
  @IsUUID()
  subjectId: string;

  @ApiProperty({ example: 'PRO' })
  @IsString()
  @IsNotEmpty()
  planCode: string;

  @ApiProperty({ required: false, description: 'Durée en jours (défaut : durée du forfait)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  durationDays?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @ApiProperty({ required: false, default: false, description: 'true = prolonger l’abonnement actif' })
  @IsOptional()
  @IsBoolean()
  renew?: boolean;

  @ApiProperty({ required: false, default: false, description: 'true = débiter le portefeuille marchand du prix du forfait (mode déductible)' })
  @IsOptional()
  @IsBoolean()
  debitWallet?: boolean;
}

export class MerchantSubscribeDto {
  @ApiProperty({ description: 'ID du commerce à abonner' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ required: false, default: 'PRO', description: 'Code du forfait marchand (ex: PRO)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  planCode?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}

export class RenewSubscriptionDto {
  @ApiProperty({ enum: SubscriptionSubjectType })
  @IsEnum(SubscriptionSubjectType)
  subjectType: SubscriptionSubjectType;

  @ApiProperty()
  @IsUUID()
  subjectId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  durationDays?: number;
}

export class SubscribeDto {
  @ApiProperty({ required: false, default: 'VIP', description: 'Code du forfait client (ex: VIP)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  planCode?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
