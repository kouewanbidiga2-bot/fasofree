import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CreateBanRequestDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de l\'utilisateur à bannir',
  })
  @IsString()
  @IsNotEmpty()
  targetUserId: string;

  @ApiProperty({
    example: 'Comportement abusif répété envers les livreurs',
    description: 'Raison détaillée de la demande de bannissement',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;
}
