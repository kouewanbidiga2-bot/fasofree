import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../modules/users/entities/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Récupère les rôles requis définis par le décorateur @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 2. Si aucun rôle n'est spécifié sur la route, accès libre
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 3. Récupère l'utilisateur injecté par le JwtAuthGuard
    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException(
        'Accès refusé : Profil ou rôle utilisateur non identifié',
      );
    }

    // Normalisation en minuscules pour éviter tout conflit de casse
    const userRole = (user.role as string).toLowerCase();

    // 👑 4. PASSE-PARTOUT : Le Super Admin bypass TOUTES les restrictions
    if (userRole === UserRole.SUPER_ADMIN.toLowerCase()) {
      return true;
    }

    // 5. Vérification si le rôle de l'utilisateur correspond aux rôles autorisés
    const hasRole = requiredRoles.some(
      (role) => role.toLowerCase() === userRole,
    );

    if (!hasRole) {
      throw new ForbiddenException(
        `Accès refusé : Le rôle [${user.role}] n'a pas les autorisations nécessaires`,
      );
    }

    return true;
  }
}
