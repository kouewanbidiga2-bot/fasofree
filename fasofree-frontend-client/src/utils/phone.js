/**
 * Normalise un numéro burkinabè au format E.164 (+226XXXXXXXX).
 * Accepte : "70123456", "66 10 10 01", "22670123456", "+22670123456"
 * Retourne null si le numéro est invalide.
 */
export function formatBurkinaPhone(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const digits = raw.replace(/[\s\-().]/g, '');

  // Déjà au format E.164 burkinabè
  if (/^\+226[56789]\d{7}$/.test(digits)) return digits;

  // Avec préfixe 226 sans le +
  if (/^226[56789]\d{7}$/.test(digits)) return '+' + digits;

  // 8 chiffres locaux (format le plus courant)
  if (/^[56789]\d{7}$/.test(digits)) return '+226' + digits;

  // 9 chiffres commençant par 0 (ex: 070123456)
  if (/^0[56789]\d{7}$/.test(digits)) return '+226' + digits.slice(1);

  return null;
}

/**
 * Format d'affichage : +226 70 12 34 56
 */
export function displayBurkinaPhone(e164) {
  if (!e164 || e164.length < 12) return e164 || '';
  return e164.slice(0, 4) + ' ' + e164.slice(4, 6) + ' ' + e164.slice(6, 8) + ' ' + e164.slice(8, 10) + ' ' + e164.slice(10);
}
