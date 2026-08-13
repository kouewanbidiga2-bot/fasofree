import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../modules/users/entities/user-role.enum';

export const ROLES_KEY = 'roles';

/**
 * Décorateur pour restreindre l'accès d'une route ou d'un contrôleur à certains rôles.
 * Exemple: @Roles(UserRole.ADMIN, UserRole.MERCHANT)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
