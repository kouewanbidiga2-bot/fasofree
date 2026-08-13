import { IsNotEmpty, IsString } from 'class-validator';

export class JoinBusinessRoomDto {
  @IsString()
  @IsNotEmpty()
  businessId: string;
}

export class JoinOrderTrackingDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;
}
