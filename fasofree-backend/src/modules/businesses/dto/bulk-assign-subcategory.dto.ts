import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * 🏷️ F-bis — taguage de masse de la sous-catégorie (niveau 2).
 *
 * Pourquoi un endpoint dédié plutôt qu'un PATCH commerce par commerce :
 * les commerces créés avant le catalogue à deux niveaux ont
 * `subCategory = NULL` et sont donc absents de tous les filtres client.
 * Les reprendre un par un depuis le back-office serait impraticable.
 *
 * Pourquoi `businessIds` explicite et non un filtre « par catégorie » :
 * seuls 5 verticales sur 6 ont une sous-catégorie unique et déductible
 * (résolues par `auto-tag`). Pour RESTAURANT (6 sous-familles), la base ne
 * peut pas deviner « Fast-Food » ou « Pizzas » : le choix doit être humain.
 */
export class BulkAssignSubCategoryDto {
  @ApiProperty({
    type: [String],
    description: 'Identifiants des commerces à taguer (max 500)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  businessIds: string[];

  @ApiProperty({
    description:
      'Sous-catégorie du catalogue. Doit appartenir à la verticale du commerce, sinon celui-ci est ignoré.',
    example: 'Fast-Food',
  })
  @IsString()
  @MaxLength(60)
  subCategory: string;
}
