/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  PushCampaignRecurrence,
  PushCampaignTarget,
} from '../entities/push-campaign.entity';

/**
 * Heure murale 'HH:MM' (00:00 → 23:59). Même contrainte que la colonne
 * `push_campaigns.timeOfDay` (varchar(5)) et que `parseTimeOfDay` du service.
 */
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

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

  /**
   * ⏱️ Date/heure de diffusion (ISO). Absente ou passée = envoi immédiat.
   */
  @ApiProperty({
    example: '2026-10-20T18:00:00.000Z',
    required: false,
    description:
      'Date de diffusion programmée. Si absente ou déjà passée, la campagne part immédiatement.',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'scheduledAt doit être une date ISO valide.' },
  )
  scheduledAt?: string;

  // ─── 🔁 Récurrence (Lot 2) ───────────────────────────────────────
  // Absente / NONE = envoi unique (comportement historique inchangé).

  /**
   * 🔁 Fréquence de répétition. NONE par défaut.
   */
  @ApiProperty({
    enum: PushCampaignRecurrence,
    default: PushCampaignRecurrence.NONE,
    required: false,
    description:
      'NONE = envoi unique. DAILY/WEEKLY/MONTHLY = la campagne se répète ; sa 1ʳᵉ diffusion est planifiée (jamais immédiate).',
  })
  @IsOptional()
  @IsEnum(PushCampaignRecurrence, {
    message: `recurrence invalide. Valeurs acceptées : ${Object.values(PushCampaignRecurrence).join(', ')}`,
  })
  recurrence?: PushCampaignRecurrence;

  /**
   * 🕒 Heure murale de diffusion 'HH:MM' dans `timeZone`.
   */
  @ApiProperty({
    example: '09:30',
    required: false,
    description:
      "Heure de diffusion 'HH:MM' dans le fuseau de la campagne. Si absente, l'heure de `scheduledAt` est utilisée.",
  })
  @IsOptional()
  @IsString()
  @Matches(TIME_OF_DAY, {
    message: "timeOfDay doit être au format 'HH:MM' (ex. 09:30).",
  })
  timeOfDay?: string;

  /**
   * 📅 Jours de la semaine pour WEEKLY (0 = dimanche … 6 = samedi).
   */
  @ApiProperty({
    example: [1, 4],
    required: false,
    type: [Number],
    description:
      'Jours de diffusion pour WEEKLY (0=dimanche … 6=samedi). Vide ou absent = jour de la semaine de `scheduledAt`.',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true, message: 'daysOfWeek doit contenir des entiers.' })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  /**
   * 🌍 Fuseau IANA d'interprétation de `timeOfDay`.
   */
  @ApiProperty({
    example: 'Africa/Ouagadougou',
    required: false,
    description:
      "Fuseau IANA (défaut : Africa/Ouagadougou). 64 = longueur de la colonne.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(64, {
    message: 'timeZone ne peut pas dépasser 64 caractères.',
  })
  timeZone?: string;

  /**
   * 🛑 Fin de la récurrence (ISO). Au-delà, la campagne passe COMPLETED.
   */
  @ApiProperty({
    example: '2026-12-31T23:59:59.000Z',
    required: false,
    description:
      'Fin de la récurrence. Aucune diffusion au-delà de cette date.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'endsAt doit être une date ISO valide.' })
  endsAt?: string;
}
