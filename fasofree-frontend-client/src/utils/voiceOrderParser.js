const FRENCH_NUMBERS = {
  'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
  'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
  'onze': 11, 'douze': 12, 'treize': 13, 'quatorze': 14, 'quinze': 15,
  'seize': 16, 'vingt': 20, 'trente': 30, 'quarante': 40, 'cinquante': 50,
};

const STOP_WORDS = new Set([
  'je', 'veux', 'voudrais', 'voudrait', 'aimerais', 'aimerait',
  'prends', 'prendre', 'prenons',
  'et', 'aussi', 'puis', 'ensuite', 'avec',
  "s'il vous plaît", 'svp', 'merci',
  "j'aimerais", "j'veux", "je prends",
  'voilà', "c'est tout", "rien d'autre",
  'pour moi', 'pour nous',
]);

const ALIASES = {
  'bouaboua': 'bouye',
  'bouye': 'bouye',
  'boule': 'boule',
  'thieb': 'thieboudienne',
  'thieboudienne': 'thieboudienne',
  'tieb': 'thieboudienne',
  'poulet': 'poulet',
  'braisé': 'braise',
  'braise': 'braise',
  'frites': 'frites',
  'frit': 'frites',
  'riz': 'riz',
  'poisson': 'poisson',
  'boeuf': 'boeuf',
  'beuf': 'boeuf',
  'mouton': 'mouton',
  'jus': 'jus',
  'bissap': 'bissap',
  'bisap': 'bissap',
  'gingembre': 'gingembre',
  'dombou': 'dombou',
  'hâtogo': 'hatogo',
  'hatogo': 'hatogo',
  'lait': 'lait',
  'cafe': 'cafe',
  'the': 'the',
  'eau': 'eau',
  'soda': 'soda',
  'coca': 'coca',
  'sprite': 'sprite',
  'fanta': 'fanta',
  'minute': 'minute',
  'maidis': 'minute maid',
  'chips': 'chips',
  'salade': 'salade',
  'sauce': 'sauce',
  'arachide': 'arachide',
  'tomate': 'tomate',
  'oignon': 'oignon',
};

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFrenchNumber(word) {
  if (!word) return 0;
  const w = word.toLowerCase().replace(/['']/g, "'");
  if (FRENCH_NUMBERS[w] !== undefined) return FRENCH_NUMBERS[w];
  const n = parseInt(w, 10);
  if (!isNaN(n)) return n;
  return 0;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function applyAlias(word) {
  return ALIASES[word] || word;
}

function splitIntoChunks(text) {
  const normalized = normalize(text);
  const chunks = [];
  const separators = /\s*(?:et|puis|ensuite|,)\s*/;
  const parts = normalized.split(separators);

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length < 2) continue;

    const words = trimmed.split(/\s+/);
    let quantity = 0;
    let dishWords = [];
    let foundQuantity = false;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];

      if (STOP_WORDS.has(w)) continue;

      const num = parseFrenchNumber(w);
      if (num > 0 && !foundQuantity) {
        quantity = num;
        foundQuantity = true;
        continue;
      }

      dishWords.push(applyAlias(w));
    }

    if (dishWords.length > 0) {
      chunks.push({
        quantity: quantity || 1,
        dishText: dishWords.join(' '),
        raw: trimmed,
      });
    }
  }

  return chunks;
}

function itemMatchesChunk(dishWords, itemNameNorm, itemDescNorm) {
  const itemNameWords = itemNameNorm.split(/\s+/);
  const fullText = itemNameNorm + ' ' + itemDescNorm;

  let matchedWords = 0;
  for (const dw of dishWords) {
    let wordMatched = false;
    for (const nw of itemNameWords) {
      if (
        nw.includes(dw) || dw.includes(nw) ||
        similarity(dw, nw) > 0.6
      ) {
        wordMatched = true;
        break;
      }
    }
    if (!wordMatched) {
      // Check if the word appears anywhere in item name or description
      if (fullText.includes(dw) || dw.length >= 4 && fullText.includes(dw.substring(0, Math.ceil(dw.length * 0.7)))) {
        wordMatched = true;
      }
    }
    if (wordMatched) matchedWords++;
  }

  const wordScore = dishWords.length > 0 ? matchedWords / dishWords.length : 0;

  // Check if ANY dish word matches ANY menu item word
  let anyMatch = false;
  for (const dw of dishWords) {
    for (const nw of itemNameWords) {
      if (
        nw.includes(dw) || dw.includes(nw) ||
        similarity(dw, nw) > 0.55 ||
        fullText.includes(dw)
      ) {
        anyMatch = true;
        break;
      }
    }
    if (anyMatch) break;
  }

  return { wordScore, anyMatch, matchedWords };
}

export function matchMenuItems(text, menuItems) {
  const chunks = splitIntoChunks(text);
  const results = [];
  const usedItemIds = new Set();

  for (const chunk of chunks) {
    if (!chunk.dishText) continue;

    const dishNorm = normalize(chunk.dishText);
    const dishWords = dishNorm.split(/\s+/);
    let bestMatch = null;
    let bestScore = 0;

    for (const item of menuItems) {
      if (!item.available || usedItemIds.has(item.id)) continue;

      const itemNameNorm = normalize(item.name);
      const itemDescNorm = normalize(item.description || '');

      // Exact substring match — highest priority
      if (itemNameNorm.includes(dishNorm) || dishNorm.includes(itemNameNorm)) {
        bestMatch = item;
        bestScore = 1;
        break;
      }

      // Word-level + fuzzy matching
      const { wordScore, anyMatch } = itemMatchesChunk(dishWords, itemNameNorm, itemDescNorm);

      // Fuzzy full-name match
      const fuzzyScore = similarity(dishNorm, itemNameNorm);

      // Partial match: check each dish word individually against item name
      let partialHits = 0;
      for (const dw of dishWords) {
        if (itemNameNorm.includes(dw) || itemDescNorm.includes(dw)) {
          partialHits++;
        }
      }
      const partialScore = dishWords.length > 0 ? partialHits / dishWords.length : 0;

      // Pick the best scoring method
      const score = Math.max(
        wordScore,
        fuzzyScore,
        partialScore,
        anyMatch ? 0.5 : 0,
      );

      if (score > bestScore && score > 0.3) {
        bestScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch) {
      usedItemIds.add(bestMatch.id);
      results.push({
        item: bestMatch,
        quantity: chunk.quantity,
        confidence: bestScore,
      });
    }
  }

  return results;
}
