// ─────────────────────────────────────────────────────────────
// 🔍 Matching de recherche « intelligent » (client)
// Utilisé par la page Recherche pour trouver un plat dans le menu
// d'un restaurant, même si le nom du commerce ne contient pas le mot.
// - insensible aux accents et à la casse
// - tolère le préfixe (saisie en cours : « pou » → « poulet »)
// - tolère le pluriel (« poulets » → « poulet »)
// - tolère 1 faute de frappe sur ≥ 5 lettres (mode « fuzzy »)
// ─────────────────────────────────────────────────────────────

/** Minuscules, sans accents, espaces normalisés. */
export const normalizeText = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Radicalisation légère : « poulets » → « poulet », « pizzas » → « pizza ». */
export const stem = (w) => {
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1);
  return w;
};

/** Texte → tableau de mots comparables (normalisés + radicalisés). */
export const tokenize = (text) =>
  normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem);

/**
 * Distance de Levenshtein (variante Damerau/OSA : une transposition de lettres
 * adjacentes compte pour 1 seule faute — la plus fréquente au clavier mobile :
 * « poulet » → « poulte »). Abandon dès que l'écart dépasse `max`.
 */
export const levenshtein = (a, b, max = 2) => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null; // d[i-2]
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j); // d[i-1]
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      // transposition de 2 lettres adjacentes = 1 seule faute
      // (« poulet » → « poulte » ou « puolet »)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
};

/** Le mot recherché correspond-il à un mot du texte ? */
export const wordHit = (token, word, fuzzy = false) => {
  if (!token || !word) return false;
  // 1 lettre : on reste sur le préfixe pour éviter le bruit (« a » ne matche pas tout)
  if (token.length === 1) return word.startsWith(token);
  if (word === token) return true;
  if (word.startsWith(token)) return true; // saisie en cours
  if (word.includes(token)) return true;
  // recherche inverse : l'utilisateur a tapé plus longtemps que le mot
  if (token.length >= 3 && word.length >= 3 && token.includes(word)) return true;
  if (fuzzy && token.length >= 5) {
    const tol = token.length >= 7 ? 2 : 1;
    if (Math.abs(word.length - token.length) <= tol && levenshtein(token, word, tol) <= tol) {
      return true;
    }
  }
  return false;
};

/** Tous les mots de la requête sont-ils présents dans le texte ? */
export const matchTokens = (tokens, words, fuzzy = false) =>
  tokens.every((tk) => words.some((w) => wordHit(tk, w, fuzzy)));