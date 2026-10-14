import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PushCampaignTarget } from '../entities/push-campaign.entity';

/**
 * 📣 Création d'une campagne push.
 *
 * Les contraintes de longueur reflètent EXACTEMENT les colonnes
 * `push_campaigns.title` (200) et `push_campaigns.body` (1000) : sans ces
 * validateurs, une chaîne trop longue provoke une erreur Postgres (500)
 * au lieu d'un 400 explicite.
 */
export class CreatePushCampaignDto {
  @ApiProperty({ example: 'Livraison offerte ce week-end' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    example: 'Profitez de la livraison offerte jusqu’à dimanche.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(1000)
  body: string;

  @ApiProperty({ enum: PushCampaignTarget, default: PushCampaignTarget.ALL })
  @IsEnum(PushCampaignTarget, {
    message: `Cible invalide. Valeurs acceptées : ${Object.values(PushCampaignTarget).join(', ')}`,
  })
  target: PushCampaignTarget;
}
