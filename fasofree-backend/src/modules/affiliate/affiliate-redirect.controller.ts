import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AffiliateService } from './affiliate.service';

/**
 * 🔗 Lien court public `/r/CODE` — servi à la RACINE du domaine API
 * (hors préfixe /api/v1, exclu dans main.ts).
 *
 * Compte le clic, pose un cookie d'attribution (30 j) et redirige (302)
 * vers la page restaurant du commerce avec le code en paramètre.
 *
 * Le cookie permet de garder l'attribution même si l'utilisateur s'inscrit
 * plus tard sur un autre appareil du même navigateur.
 */
@Controller('r')
export class AffiliateRedirectController {
  constructor(
    private readonly affiliate: AffiliateService,
    private readonly config: ConfigService,
  ) {}

  @Get(':code')
  async redirect(
    @Param('code') code: string,
    @Res() res: Response,
  ): Promise<void> {
    // Normalisation : les codes sont stockés en majuscules (FF-XXXXXX).
    // On borne aussi la longueur pour éviter de sonder la base avec
    // des codes arbitraires.
    const normalized = code?.trim().toUpperCase();
    if (!normalized || !/^FF-[0-9A-F]{6}$/.test(normalized)) {
      throw new NotFoundException('Lien de suivi inconnu');
    }

    const link = await this.affiliate.recordClick(normalized);
    if (!link) {
      throw new NotFoundException('Lien de suivi inconnu');
    }

    const clientUrl = this.config
      .get<string>('CLIENT_URL', 'https://www.fasofree.site')
      .replace(/\/$/, '');

    // ⚠️ Le cookie est posé depuis le domaine API mais lu par le front
    // (www.fasofree.site). Sans `domain`, le navigateur le rattacherait à
    // `api.fasofree.site` et le front ne pourrait JAMAIS le lire →
    // l'attribution serait perdue. `AFFILIATE_COOKIE_DOMAIN` doit valoir le
    // domaine parent (ex. `.fasofree.site`).
    const cookieDomain = this.config.get<string>('AFFILIATE_COOKIE_DOMAIN');

    res.cookie('aff_code', link.code, {
      maxAge: 30 * 24 * 3_600_000,
      httpOnly: false, // lu par le front à l'inscription
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      ...(cookieDomain ? { domain: cookieDomain } : {}),
      path: '/',
    });

    res.redirect(
      302,
      `${clientUrl}/restaurant/${link.businessId}?ref=${encodeURIComponent(link.code)}`,
    );
  }
}
