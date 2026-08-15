import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseFilePipeBuilder,
  HttpStatus,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { Roles } from '../../core/security/roles.decorator';
import { RolesGuard } from '../../core/security/roles.guard';
import { UserRole } from '../users/entities/user-role.enum';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { KycDocumentType, KycStatus } from './entities/kyc-document.entity';
import { KycService } from './kyc.service';

type AuthRequest = ExpressRequest & {
  user: { userId: string; role: UserRole };
};

// Rôles autorisés à modérer et consulter les KYC administratifs
const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT];

@ApiTags('KYC')
@ApiBearerAuth('JWT-auth')
@Controller('kyc')
@UseGuards(AuthGuard('jwt'), RolesGuard) // 🛡️ Les 2 Guards s'appliquent globalement sur tout le contrôleur
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Post('documents/:type')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  submit(
    @Param('type') type: KycDocumentType,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|pdf)$/,
        })
        .addMaxSizeValidator({
          maxSize: 10 * 1024 * 1024, // 10MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        }),
    )
    file: Express.Multer.File,
    @Request() req: AuthRequest,
  ) {
    return this.kyc.submit(req.user.userId, type, file);
  }

  @Get('me')
  mine(@Request() req: AuthRequest) {
    return this.kyc.mine(req.user.userId);
  }

  @Get('documents/:id/url')
  signedUrl(@Param('id') id: string, @Request() req: AuthRequest) {
    // 🛡️ CORRECTION : N'importe quel rôle admin/support peut voir l'URL signée du document
    const isAdminOrSupport = ADMIN_ROLES.includes(req.user.role);

    return this.kyc.signedUrl(id, req.user.userId, isAdminOrSupport);
  }

  // =========================================================================
  // 🏢 ROUTES D'ADMINISTRATION & MODÉRATION KYC
  // =========================================================================

  @Get('admin/pending')
  @Roles(...ADMIN_ROLES) // 🔓 Accessible aux Super Admin, Admin et Support
  listPending() {
    return this.kyc.pending();
  }

  @Post('admin/:id/approve')
  @Roles(...ADMIN_ROLES) // 🔓 Accessible aux Super Admin, Admin et Support
  approve(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.kyc.review(id, req.user.userId, KycStatus.APPROVED);
  }

  @Post('admin/:id/reject')
  @Roles(...ADMIN_ROLES) // 🔓 Accessible aux Super Admin, Admin et Support
  reject(
    @Param('id') id: string,
    @Body() dto: ReviewKycDto,
    @Request() req: AuthRequest,
  ) {
    return this.kyc.review(id, req.user.userId, KycStatus.REJECTED, dto.reason);
  }
}
