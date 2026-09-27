import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LegalService } from './legal.service';
import { RecordAcceptanceDto, SignContractDto } from './dto/legal.dto';
import { UserRole } from '../users/entities/user-role.enum';

/**
 * ⚖️ Endpoints du pack légal.
 *
 * Publics :
 * - GET  /legal/documents          → liste des documents (métadonnées)
 * - GET  /legal/documents/:docCode → document complet (markdown)
 *
 * Protégés (JWT) :
 * - POST /legal/acceptances        → enregistrer une acceptation (case à cocher)
 * - GET  /legal/acceptances/me     → son historique d'acceptations
 * - GET  /legal/contracts/pending  → contrat à signer (marchand/livreur) ou null
 * - POST /legal/contracts/send-otp → envoyer le code de signature
 * - POST /legal/contracts/sign     → vérifier le code + enregistrer la signature
 */
@ApiTags('Legal')
@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  @Get('documents')
  @ApiOperation({ summary: 'Lister les documents légaux (métadonnées, sans contenu)' })
  async listDocuments() {
    return this.legalService.listDocuments();
  }

  @Get('documents/:docCode')
  @ApiOperation({ summary: 'Obtenir un document légal complet (contenu Markdown)' })
  async getDocument(@Param('docCode') docCode: string) {
    return this.legalService.getDocument(docCode);
  }

  // ─── Protégé : acceptations ───────────────────────────────────────────────

  @Post('acceptances')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: "Enregistrer l'acceptation d'un document (case à cocher)",
  })
  async recordAcceptance(
    @Request() req,
    @Body() dto: RecordAcceptanceDto,
    @Ip() ip: string,
  ) {
    // 🔒 Le mécanisme est IMPOSÉ côté serveur : la route générique d'acceptation
    // ne peut enregistrer qu'une case à cocher. La signature de contrat
    // (signature-otp) n'est atteignable QUE via POST /legal/contracts/sign
    // qui vérifie le code OTP dédié. Sinon, un utilisateur pourrait forger
    // une « signature » depuis la console du navigateur.
    const { recorded } = await this.legalService.recordAcceptances(
      req.user.userId,
      [{ docCode: dto.docCode, docVersion: dto.docVersion }],
      'case-a-cocher',
      dto.source || 'api',
      ip,
    );
    return { accepted: recorded };
  }

  @Get('acceptances/me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: "Historique d'acceptations du compte connecté" })
  async myAcceptances(@Request() req) {
    return this.legalService.getMyAcceptances(req.user.userId);
  }

  // ─── Protégé : signature de contrat marchand / livreur ───────────────────

  @Get('contracts/pending')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Contrat en attente de signature pour le compte connecté (marchand/livreur)',
  })
  async pendingContract(@Request() req) {
    const contract = await this.legalService.getPendingContract(
      req.user.userId,
      req.user.role as UserRole,
    );
    return { pending: contract !== null, contract };
  }

  @HttpCode(HttpStatus.OK)
  @Post('contracts/send-otp')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @ApiOperation({ summary: 'Envoyer le code OTP de signature du contrat' })
  async sendContractOtp(@Request() req) {
    return this.legalService.sendContractOtp(
      req.user.userId,
      req.user.role as UserRole,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('contracts/sign')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @ApiOperation({ summary: 'Vérifier le code OTP et signer le contrat' })
  async signContract(
    @Request() req,
    @Body() dto: SignContractDto,
    @Ip() ip: string,
  ) {
    return this.legalService.signContract(
      req.user.userId,
      req.user.role as UserRole,
      dto.code,
      ip,
    );
  }
}