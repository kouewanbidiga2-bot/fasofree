import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../modules/users/entities/user-role.enum';
import { ROLES_KEY } from './roles.decorator';
import { Request } from 'express';

type RequestWithUser = Request & {
  user?: { userId?: string; role?: UserRole };
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si aucun rôle spécifique n'est exigé, l'accès est autorisé
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Accès refusé : Identité non reconnue');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `Accès refusé : Votre rôle [${user.role}] n'a pas les privilèges requis`,
      );
    }

    return true;
  }
}
