import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendDisputeMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
