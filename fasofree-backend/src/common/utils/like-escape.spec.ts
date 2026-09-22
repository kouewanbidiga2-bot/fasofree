import { escapeLikeTerm } from './like-escape';

describe('escapeLikeTerm', () => {
  it('n\'altère pas un terme sans wildcard', () => {
    expect(escapeLikeTerm('chef')).toBe('chef');
    expect(escapeLikeTerm('chez césar')).toBe('chez césar');
  });

  it('échappe le wildcard %', () => {
    expect(escapeLikeTerm('100%')).toBe('100\\%');
    expect(escapeLikeTerm('%')).toBe('\\%');
  });

  it('échappe le wildcard _', () => {
    expect(escapeLikeTerm('a_b')).toBe('a\\_b');
    expect(escapeLikeTerm('_')).toBe('\\_');
  });

  it('échappe l\'antislash de contrôle', () => {
    expect(escapeLikeTerm('a\\b')).toBe('a\\\\b');
  });

  it('échappe une combinaison % _ \\', () => {
    expect(escapeLikeTerm('%a_b\\c%')).toBe('\\%a\\_b\\\\c\\%');
  });

  it('neutralise une tentative de masque "matche tout"', () => {
    // "%" échappé ne match plus toutes les lignes de la table.
    expect(escapeLikeTerm('%')).toBe('\\%');
    expect(escapeLikeTerm('%%%')).toBe('\\%\\%\\%');
  });

  it('gère une chaîne vide', () => {
    expect(escapeLikeTerm('')).toBe('');
  });
});