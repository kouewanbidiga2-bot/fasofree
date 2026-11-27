import { Type } from 'class-transformer';
import { IsDefined, IsEmail, IsNotEmpty, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { IsBurkinaPhone } from '../../auth/validators/is-burkina-phone.validator';
import { P2PLocationDto } from './p2p-location.dto';
import { PackageDetailsDto } from './package-details.dto';

export class GuestDeliveryDto {
  @Matches(/^[a-f0-9]{64}$/)
  checkoutKey: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsBurkinaPhone()
  phone: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => P2PLocationDto)
  pickupLocation: P2PLocationDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => P2PLocationDto)
  dropoffLocation: P2PLocationDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => PackageDetailsDto)
  packageDetails: PackageDetailsDto;
}
