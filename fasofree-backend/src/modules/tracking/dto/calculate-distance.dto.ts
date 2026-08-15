import { IsNumber, IsLatitude, IsLongitude } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CalculateDistanceDto {
  @ApiProperty({ example: 12.3714 })
  @IsNumber()
  @IsLatitude()
  originLatitude: number;

  @ApiProperty({ example: -1.5197 })
  @IsNumber()
  @IsLongitude()
  originLongitude: number;

  @ApiProperty({ example: 12.3522 })
  @IsNumber()
  @IsLatitude()
  destinationLatitude: number;

  @ApiProperty({ example: -1.5011 })
  @IsNumber()
  @IsLongitude()
  destinationLongitude: number;
}
