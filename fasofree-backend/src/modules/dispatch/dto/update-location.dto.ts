import {
  IsNumber,
  IsOptional,
  IsString,
  IsLatitude,
  IsLongitude,
} from 'class-validator';

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsNumber()
  @IsLatitude()
  latitude: number;

  @IsNumber()
  @IsLongitude()
  longitude: number;

  @IsOptional()
  @IsNumber()
  heading?: number;
}
