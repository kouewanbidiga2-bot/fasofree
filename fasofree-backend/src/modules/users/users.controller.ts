import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
  Request as NestRequest,
  UnauthorizedException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from './entities/user-role.enum';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { STORAGE_DRIVER } from '../upload/upload.module';

type RequestWithUser = ExpressRequest & {
  user?: { userId?: string; role?: UserRole };
};

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(STORAGE_DRIVER)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly storageDriver: any,
  ) {}

  // 👤 Route protégée : Récupérer son propre profil
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @ApiOperation({ summary: "Obtenir le profil de l'utilisateur connecté" })
  async getProfile(@NestRequest() req: RequestWithUser) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.usersService.findById(userId);
  }

  // 👤 Route protégée : Mettre à jour son propre profil
  @UseGuards(AuthGuard('jwt'))
  @Patch('me')
  @ApiOperation({ summary: "Mettre à jour le profil de l'utilisateur connecté" })
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.usersService.updateProfile(userId, dto);
  }

  // 📸 Mettre à jour l'avatar de profil (upload vers Cloudinary)
  @UseGuards(AuthGuard('jwt'))
  @Post('me/avatar')
  @ApiOperation({ summary: "Uploader un avatar de profil (JPEG, PNG, WebP — max 5 Mo)" })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|webp)$/i,
        })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({
          errorHttpStatusCode: HttpStatus.BAD_REQUEST,
          exceptionFactory: () => {
            throw new BadRequestException(
              'Avatar: type non supporté ou fichier trop volumineux (max 5 Mo, JPEG/PNG/WebP)',
            );
          },
        }),
    )
    file: Express.Multer.File,
    @NestRequest() req: RequestWithUser,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    const result = await this.storageDriver.uploadFile(file, 'avatars');
    await this.usersService.updateAvatar(userId, result.url);
    return { avatarUrl: result.url };
  }

  // 🛵 Statut de disponibilité du livreur/coursier (DRIVER / COURIER)
  @UseGuards(AuthGuard('jwt'))
  @Patch('me/driver-status')
  @ApiOperation({
    summary:
      'Mettre à jour son statut de livreur (en ligne, position GPS, véhicule)',
  })
  async setDriverStatus(
    @Body() dto: UpdateDriverStatusDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.usersService.setDriverStatus(userId, dto);
  }

  // 🛡️ Lister tous les utilisateurs (Super Admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  @ApiOperation({ summary: 'Lister les utilisateurs (super administrateur)' })
  async getAllUsers() {
    return this.usersService.findAll();
  }

  // 🛡️ Créer un utilisateur avec un rôle donné (réservé au Super Admin).
  // C'est l'UNIQUE moyen de créer des comptes ADMIN / SUPPORT / SUPER_ADMIN.
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Créer un utilisateur (SUPER_ADMIN) — seul moyen de créer un ADMIN/SUPPORT',
  })
  async createUser(
    @Body() dto: CreateUserDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const operatorId = req.user?.userId;
    if (!operatorId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    const operator = await this.usersService.findById(operatorId);
    return this.usersService.create({
      email: dto.email,
      password: dto.password,
      role: dto.role ?? UserRole.CLIENT,
      fullName: dto.fullName,
      phone: dto.phone,
    });
  }

  // 🚫 Bannir / réactiver un compte
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Bannir ou réactiver un compte (SUPER_ADMIN)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const operatorId = req.user?.userId;
    if (!operatorId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    const operator = await this.usersService.findById(operatorId);
    return this.usersService.setActiveStatus(operator, id, dto.isActive);
  }

  // 🔄 Changer le rôle d'un utilisateur
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id/role')
  @ApiOperation({ summary: 'Changer le rôle d’un utilisateur (SUPER_ADMIN)' })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const operatorId = req.user?.userId;
    if (!operatorId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    const operator = await this.usersService.findById(operatorId);
    return this.usersService.updateRole(operator, id, dto.role);
  }

  // 🗑️ Supprimer définitivement un compte (Super Admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer définitivement un utilisateur (SUPER_ADMIN)' })
  async deleteUser(
    @Param('id') id: string,
    @NestRequest() req: RequestWithUser,
  ) {
    const operatorId = req.user?.userId;
    if (!operatorId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    const operator = await this.usersService.findById(operatorId);
    return this.usersService.deleteUser(operator, id);
  }
}
