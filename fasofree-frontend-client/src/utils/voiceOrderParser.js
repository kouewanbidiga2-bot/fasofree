const FRENCH_NUMBERS = {
  'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
  'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
  'onze': 11, 'douze': 12, 'treize': 13, 'quatorze': 14, 'quinze': 15,
  'seize': 16, 'vingt': 20, 'trente': 30, 'quarante': 40, 'cinquante': 50,
};

const STOP_WORDS = new Set([
  'je', 'veux', 'voudrais', 'voudrait', 'aimerais', 'aimerait',
  'prends', 'prendre', 'prenons',
  'des', 'de', 'du', 'le', 'la', 'les', 'un', 'une',
  'et', 'aussi', 'puis', 'ensuite', 'avec',
  "s'il vous plaît", 'svp', 'merci',
  "j'aimerais", "j'veux", "je prends",
  'avec ça', 'voilà', "c'est tout", 'rien d\'autre',
  'pour moi', 'pour nous',
]);

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
      if (STOP_WORDS.has(words[i])) continue;

      const num = parseFrenchNumber(words[i]);
      if (num > 0 && !foundQuantity) {
        quantity = num;
        foundQuantity = true;
        continue;
      }

      dishWords.push(words[i]);
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

export function matchMenuItems(text, menuItems) {
  const chunks = splitIntoChunks(text);
  const results = [];
  const usedItemIds = new Set();

  for (const chunk of chunks) {
    if (!chunk.dishText) continue;

    const dishNorm = normalize(chunk.dishText);
    let bestMatch = null;
    let bestScore = 0;

    for (const item of menuItems) {
      if (!item.available || usedItemIds.has(item.id)) continue;

      const itemNameNorm = normalize(item.name);
      const itemDescNorm = normalize(item.description || '');

      // Exact substring match
      if (itemNameNorm.includes(dishNorm) || dishNorm.includes(itemNameNorm)) {
        bestMatch = item;
        bestScore = 1;
        break;
      }

      // Word-level matching
      const dishWords = dishNorm.split(/\s+/);
      const nameWords = itemNameNorm.split(/\s+/);
      let matchedWords = 0;
      for (const dw of dishWords) {
        for (const nw of nameWords) {
          if (nw.includes(dw) || dw.includes(nw) || similarity(dw, nw) > 0.75) {
            matchedWords++;
            break;
          }
        }
      }
      const wordScore = dishWords.length > 0 ? matchedWords / dishWords.length : 0;

      // Fuzzy full-name match
      const fuzzyScore = similarity(dishNorm, itemNameNorm);

      // Boost if dish words appear in description too
      let descBoost = 0;
      if (itemDescNorm) {
        for (const dw of dishWords) {
          if (itemDescNorm.includes(dw)) descBoost += 0.1;
        }
      }

      const score = Math.max(wordScore * 0.7 + descBoost, fuzzyScore * 0.6 + descBoost);

      if (score > bestScore && score > 0.45) {
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
