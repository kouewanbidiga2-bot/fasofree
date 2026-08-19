import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class VerifiedGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('Authentification requise');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new ForbiddenException('Utilisateur introuvable');
    }

    if (['admin', 'super_admin'].includes(user.role)) {
      return true;
    }

    if (!user.isEmailVerified || !user.isPhoneVerified) {
      throw new ForbiddenException(
        "Votre compte n'est pas encore vérifié. Veuillez vérifier votre email et téléphone via OTP.",
      );
    }

    return true;
  }
}
