import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsNumber,
} from 'class-validator';
import { PromotionKind } from '../entities/promotion.entity';

export class CreatePromotionDto {
  @IsString() @MaxLength(32) code: string;
  @IsEnum(PromotionKind) kind: PromotionKind;
  @Type(() => Number) @IsNumber() @Min(1) value: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minimumOrderAmount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) usageLimit?: number;
  @IsDateString() startsAt: string;
  @IsDateString() endsAt: string;
}
