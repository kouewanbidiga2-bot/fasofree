import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalDocument } from './entities/legal-document.entity';
import { ContractAcceptance } from './entities/contract-acceptance.entity';
import { LEGAL_DOCUMENTS_SEED } from './data/legal-documents.data';
import { AcceptedDocDto } from './dto/legal.dto';
import { OtpService } from '../otp/otp.service';
import { UserRole } from '../users/entities/user-role.enum';

/**
 * Codes des documents du Legal Pack (docs/legal/README.md).
 */
export const LEGAL_DOC_CODES = {
  CGU: 'FR-CGU-001',
  PRIV: 'FR-PRIV-002',
  COOKIES: 'FR-COOK-003',
  CGV: 'FR-CGV-004',
  PARTENARIAT_COMMERCIAL: 'FR-PMERC-005',
  CONTRAT_CADRE_LIVREUR: 'FR-LIVR-006',
  SECURITE_LIVREUR: 'FR-SECUR-007',
  REMBOURSEMENT: 'FR-RMB-008',
  ANTI_FRAUDE: 'FR-ANFR-009',
  DPI: 'FR-DPI-010',
  TARIFS: 'FR-TAR-011',
} as const;

/**
 * Contrats à SIGNER (mécanisme signature-otp) selon le rôle.
 * business_admin → contrat de partenariat commercial ; driver → contrat-cadre.
 */
const CONTRACT_BY_ROLE: Partial<Record<UserRole, string>> = {
  [UserRole.BUSINESS_ADMIN]: LEGAL_DOC_CODES.PARTENARIAT_COMMERCIAL,
  [UserRole.DRIVER]: LEGAL_DOC_CODES.CONTRAT_CADRE_LIVREUR,
};

/**
 * Documents requis dès l'inscription (case à cocher) : CGU + confidentialité.
 */
const ONBOARDING_REQUIRED_DOCS = [LEGAL_DOC_CODES.CGU, LEGAL_DOC_CODES.PRIV];

/**
 * ⚖️ Service central du pack légal.
 *
 * - Seed : au boot, upsert des documents depuis le contenu embarqué
 *   (LEGAL_DOCUMENTS_SEED généré depuis docs/legal/*.md — le Dockerfile ne
 *   copiant que src/, la DB est la source de vérité pour les textes).
 * - Lecteurs : listes et documents servis aux applications (routes publiques).
 * - Acceptations : enregistrement horodaté (mécanisme + source + ip) et
 *   rejet des versions obsolètes (on ne signe QUE la version courante).
 * - Signature contrat marchand/livreur : OTP dédié + enregistrement du
 *   contrat en « signature-otp » (le compte reste actif ; le dashboard bloque
 *   l'accès aux fonctions tant que le contrat n'est pas signé).
 */
@Injectable()
export class LegalService implements OnModuleInit {
  private readonly logger = new Logger(LegalService.name);

  constructor(
    @InjectRepository(LegalDocument)
    private readonly docRepository: Repository<LegalDocument>,
    @InjectRepository(ContractAcceptance)
    private readonly acceptanceRepository: Repository<ContractAcceptance>,
    private readonly otpService: OtpService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDocuments();
  }

  // ─── Seed ────────────────────────────────────────────────────────────────

  /** Upsert les documents embarqués (version/content à jour, idempotent). */
  async seedDocuments(): Promise<void> {
    for (const doc of LEGAL_DOCUMENTS_SEED) {
      const existing = await this.docRepository.findOne({
        where: { docCode: doc.docCode },
      });
      // `updatedAt` ne bouge QUE si quelque chose change réellement (métadonnées
      // OU contenu) : il garde sa valeur d'audit (dernier changement éditorial)
      // au lieu de dater chaque redémarrage de l'instance. Le tuple COMPLET est
      // comparé — un front-matter passé de « brouillon-avocat » à « publie »
      // (sans bump de version) doit bien être persisté.
      if (
        !existing ||
        existing.version !== doc.version ||
        existing.title !== doc.title ||
        existing.statut !== doc.statut ||
        existing.mecanisme !== doc.mecanisme ||
        existing.audience !== doc.audience ||
        existing.date !== doc.date ||
        existing.contentMd !== doc.contentMd
      ) {
        await this.docRepository.save(
          this.docRepository.create({
            ...doc,
            updatedAt: new Date(),
          }),
        );
      }
    }
    this.logger.log(
      `[Legal] ${LEGAL_DOCUMENTS_SEED.length} documents légaux seedés/vérifiés`,
    );
  }

  // ─── Lecture publique ────────────────────────────────────────────────────

  /**
   * Liste des documents du pack EN VIGUEUR, SANS le contenu (métadonnées).
   *
   * NB : pas de filtre `statut` — les 11 documents (dont les brouillons en
   * attente de relecture avocat) sont les textes courants de la plateforme à
   * ce stade de vie. La colonne `statut` (a-relire-avocat, brouillon-avocat,
   * publie) est conservée en métadonnée pour un futur gating de publication.
   */
  async listDocuments(): Promise<
    Array<Omit<LegalDocument, 'contentMd'>>
  > {
    const docs = await this.docRepository.find({
      order: { docCode: 'ASC' },
    });
    return docs.map(({ contentMd: _content, ...meta }) => meta);
  }

  /** Document complet (avec contenu Markdown) par code. */
  async getDocument(docCode: string): Promise<LegalDocument> {
    const doc = await this.docRepository.findOne({ where: { docCode } });
    if (!doc) {
      throw new NotFoundException(`Document légal ${docCode} introuvable`);
    }
    return doc;
  }

  // ─── Acceptations ────────────────────────────────────────────────────────

  /**
   * Valide une liste {docCode, docVersion} contre les versions COURANTES.
   * Throws si :
   * - la liste est vide ;
   * - un document est inconnu ou une version est obsolète ;
   * - un document à mécanisme « signature-otp » (FR-PMERC-005, FR-LIVR-006)
   *   est soumis par la voie case à cocher (signature électronique requise) ;
   * - un même docCode apparaît plusieurs fois dans la liste.
   * Renvoie la liste normalisée (prête à enregistrer).
   */
  async validateAcceptances(
    docs: AcceptedDocDto[],
  ): Promise<AcceptedDocDto[]> {
    if (!Array.isArray(docs) || docs.length === 0) {
      throw new BadRequestException(
        "Vous devez accepter les conditions générales et la politique de confidentialité",
      );
    }

    const current = await this.docRepository.find();
    const byCode = new Map(current.map((d) => [d.docCode, d]));
    const seen = new Set<string>();

    for (const acceptance of docs) {
      if (!acceptance?.docCode || !acceptance?.docVersion) {
        throw new BadRequestException('Acceptation invalide : docCode et docVersion requis');
      }
      const doc = byCode.get(acceptance.docCode);
      if (!doc) {
        throw new BadRequestException(`Document légal ${acceptance.docCode} inconnu`);
      }
      if (doc.version !== acceptance.docVersion) {
        throw new BadRequestException(
          `Le document ${acceptance.docCode} a évolué : version ${doc.version} requise (vous avez envoyé ${acceptance.docVersion}). Rechargez la page et ré-acceptez.`,
        );
      }
      // 🔒 Intégrité du registre : un document à mécanisme « signature-otp »
      // (FR-PMERC-005, FR-LIVR-006) ne peut JAMAIS être accepté par simple
      // case à cocher — seule la vérification du code OTP dédié
      // (POST /legal/contracts/sign) crée la preuve de signature.
      // NB : on ne rejette QUE signature-otp (pas « uniquement case-a-cocher ») :
      // chaque document a son mécanisme propre (validation-commande,
      // consentement-traceurs, rattache-cgu-contrats…).
      if (doc.mecanisme === 'signature-otp') {
        throw new BadRequestException(
          `Le document ${acceptance.docCode} exige une signature électronique par code OTP : il ne peut pas être accepté par simple case à cocher.`,
        );
      }
      if (seen.has(acceptance.docCode)) {
        throw new BadRequestException(`Document ${acceptance.docCode} accepté en double`);
      }
      seen.add(acceptance.docCode);
    }
    return docs;
  }

  /** Impose le minimum légal à l'inscription (CGU + confidentialité). */
  async assertOnboardingDocs(docs: AcceptedDocDto[]): Promise<AcceptedDocDto[]> {
    const normalized = await this.validateAcceptances(docs);

    const accepted = new Set(normalized.map((d) => d.docCode));
    const missing = ONBOARDING_REQUIRED_DOCS.filter((code) => !accepted.has(code));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Vous devez accepter les conditions légales obligatoires : ${missing.join(', ')}`,
      );
    }
    return normalized;
  }

  /**
   * Enregistre les acceptations (upsert sur userId+docCode+docVersion).
   * Une même version ré-acceptée est un no-op (pas de doublon).
   * Refuse (400) d'écraser une preuve de signature OTP existante par un
   * mécanisme différent (l'horodatage et le mécanisme d'une signature ne
   * doivent jamais être déclassés). Validation validateAcceptances appliquée.
   */
  async recordAcceptances(
    userId: string,
    docs: AcceptedDocDto[],
    mechanism: string,
    source: string,
    ip?: string,
  ): Promise<{ recorded: Array<{ docCode: string; docVersion: string }> }> {
    const normalized = await this.validateAcceptances(docs);
    const recorded: Array<{ docCode: string; docVersion: string }> = [];

    for (const acceptance of normalized) {
      // 🔒 Ne jamais déclasser une preuve de signature : si une signature-otp
      // existe déjà pour (userId, docCode, docVersion), un ré-enregistrement
      // par une autre voie (erreur d'intégration ou requête hostile) est REFUSÉ
      // au lieu d'écraser silencieusement le mécanisme et l'horodatage.
      // Sans cette garde, POST /legal/acceptances pourrait faire disparaître
      // la seule preuve d'une signature OTP (et re-bloquer le dashboard).
      const existing = await this.acceptanceRepository.findOne({
        where: {
          userId,
          docCode: acceptance.docCode,
          docVersion: acceptance.docVersion,
        },
      });
      if (existing?.mechanism === 'signature-otp' && mechanism !== 'signature-otp') {
        throw new BadRequestException(
          `Ce document (${acceptance.docCode}) a déjà été signé par code : la preuve de signature ne peut pas être remplacée.`,
        );
      }

      await this.acceptanceRepository.upsert(
        this.acceptanceRepository.create({
          userId,
          docCode: acceptance.docCode,
          docVersion: acceptance.docVersion,
          mechanism,
          source,
          ip: ip ?? null,
          acceptedAt: new Date(),
        }),
        ['userId', 'docCode', 'docVersion'],
      );
      recorded.push({
        docCode: acceptance.docCode,
        docVersion: acceptance.docVersion,
      });
    }

    this.logger.log(
      `[Legal] ${recorded.length} acceptation(s) enregistrée(s) pour ${userId} (${mechanism})`,
    );
    return { recorded };
  }

  /** Historique d'acceptations d'un compte (route /legal/acceptances/me). */
  async getMyAcceptances(userId: string): Promise<ContractAcceptance[]> {
    return this.acceptanceRepository.find({
      where: { userId },
      order: { acceptedAt: 'DESC' },
    });
  }

  // ─── Signature de contrat (marchands & livreurs) ─────────────────────────

  /** Contrat à signer pour le rôle (business_admin → PMERC, driver → LIVR). */
  static requiredContractDoc(role: UserRole): string | null {
    return CONTRACT_BY_ROLE[role] ?? null;
  }

  /**
   * Contrat en attente pour un compte ({docCode, docVersion, title}) ou null
   * si rien à signer (client/admin) ou déjà signé à la version courante.
   */
  async getPendingContract(
    userId: string,
    role: UserRole,
  ): Promise<{
    docCode: string;
    docVersion: string;
    title: string;
  } | null> {
    const requiredCode = LegalService.requiredContractDoc(role);
    if (!requiredCode) return null;

    const doc = await this.getDocument(requiredCode);
    const signed = await this.acceptanceRepository.findOne({
      where: {
        userId,
        docCode: requiredCode,
        docVersion: doc.version,
        mechanism: 'signature-otp',
      },
    });

    if (signed) return null;

    return {
      docCode: doc.docCode,
      docVersion: doc.version,
      title: doc.title,
    };
  }

  /**
   * Envoie le code OTP de signature du contrat exigé pour le rôle.
   * Rejette si rien à signer (aucun contrat en attente).
   */
  async sendContractOtp(userId: string, role: UserRole) {
    const pending = await this.getPendingContract(userId, role);
    if (!pending) {
      throw new BadRequestException(
        'Aucun contrat en attente de signature pour ce compte',
      );
    }
    this.logger.log(
      `[Legal] OTP de signature demandé pour ${userId} (${pending.docCode})`,
    );
    return this.otpService.sendContractOtp(userId);
  }

  /**
   * Signe le contrat : vérifie le code OTP dédié puis enregistre l'acceptation
   * du contrat à la version courante (mécanisme signature-otp).
   */
  async signContract(
    userId: string,
    role: UserRole,
    code: string,
    ip?: string,
  ): Promise<{ signed: boolean; docCode: string; docVersion: string; acceptedAt: Date }> {
    const pending = await this.getPendingContract(userId, role);
    if (!pending) {
      throw new BadRequestException(
        'Aucun contrat en attente de signature pour ce compte',
      );
    }

    await this.otpService.verifyContractOtp(userId, code);

    const acceptedAt = new Date();
    await this.acceptanceRepository.upsert(
      this.acceptanceRepository.create({
        userId,
        docCode: pending.docCode,
        docVersion: pending.docVersion,
        mechanism: 'signature-otp',
        source: 'dashboard',
        ip: ip ?? null,
        acceptedAt,
      }),
      ['userId', 'docCode', 'docVersion'],
    );

    this.logger.log(
      `[Legal] Contrat ${pending.docCode} v${pending.docVersion} signé par ${userId}`,
    );

    return {
      signed: true,
      docCode: pending.docCode,
      docVersion: pending.docVersion,
      acceptedAt,
    };
  }
}