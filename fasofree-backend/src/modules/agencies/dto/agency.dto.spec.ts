import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAgencyDto, UpdateAgencyDto } from './agency.dto';

/**
 * 🎨 Lot 1 — Identité des sociétés de livraison.
 *
 * POURQUOI CES TESTS : les contraintes DTO doivent refléter exactement les
 * colonnes Postgres (AGENTS §4). Une longueur non bornée côté DTO ferait
 * remonter une erreur 500 « value too long » au lieu d'un 400 explicite.
 * On verrouille aussi le cas « chaîne vide » qui sert à effacer une couleur :
 * `@IsOptional()` ne saute PAS la validation d'une chaîne vide, donc la regex
 * doit l'accepter explicitement.
 */
describe('Agency branding DTO (Lot 1)', () => {
  const branding = {
    logoUrl: 'https://cdn.fasofree.site/agencies/logo.png',
    description: 'Livraison de colis à Ouagadougou et Bobo-Dioulasso.',
    brandColor: '#C1652E',
    website: 'https://transport-x.bf',
    isVerified: true,
  };

  it('accepte un branding valide (création)', async () => {
    const dto = plainToInstance(CreateAgencyDto, {
      name: 'Transport X',
      ...branding,
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepte un branding valide (mise à jour)', async () => {
    const dto = plainToInstance(UpdateAgencyDto, branding);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepte une chaîne vide comme « champ effacé »', async () => {
    // Cas réel : l'admin vide le champ couleur / logo dans le formulaire.
    const dto = plainToInstance(UpdateAgencyDto, {
      logoUrl: '',
      description: '',
      brandColor: '',
      website: '',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('tolère un branding totalement absent', async () => {
    const dto = plainToInstance(CreateAgencyDto, { name: 'Sans branding' });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('refuse une couleur non hexadécimale', async () => {
    for (const bad of ['red', 'C1652E', '#ZZZZZZ', '#C1652', 'rgb(1,2,3)']) {
      const dto = plainToInstance(UpdateAgencyDto, { brandColor: bad });
      await expect(validate(dto)).resolves.not.toHaveLength(0);
    }
  });

  it('accepte les formats courts #RGB et longs #RRGGBB', async () => {
    for (const ok of ['#abc', '#ABC', '#C1652E']) {
      const dto = plainToInstance(UpdateAgencyDto, { brandColor: ok });
      await expect(validate(dto)).resolves.toHaveLength(0);
    }
  });

  it('refuse un logoUrl de plus de 500 caractères (longueur colonne)', async () => {
    const dto = plainToInstance(UpdateAgencyDto, {
      logoUrl: 'https://x.bf/' + 'a'.repeat(500),
    });
    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('refuse un website de plus de 255 caractères (longueur colonne)', async () => {
    const dto = plainToInstance(UpdateAgencyDto, {
      website: 'https://' + 'a'.repeat(260),
    });
    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('refuse une description de plus de 2000 caractères', async () => {
    const dto = plainToInstance(UpdateAgencyDto, {
      description: 'a'.repeat(2001),
    });
    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('exige toujours le nom à la création', async () => {
    const dto = plainToInstance(CreateAgencyDto, { brandColor: '#C1652E' });
    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
