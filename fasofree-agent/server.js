require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Derrière Render, req.ip doit venir de X-Forwarded-For (sinon toutes les
// requêtes partagent l'IP du proxy et le blocage anti-force-brute devient global)
app.set("trust proxy", 1);

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

// JSON malformé → réponse JSON propre au lieu d'une stack trace HTML
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Corps JSON invalide." });
  }
  next(err);
});

/* ------------------------------------------------------------------ */
/* Base de données : PostgreSQL (DATABASE_URL, hébergement) ou         */
/* SQLite local (node:sqlite, zéro dépendance, développement hors ligne)*/
/* ------------------------------------------------------------------ */

const usePg = Boolean(process.env.DATABASE_URL);
const DATA_DIR = path.join(__dirname, "data");

let sqlite = null;
let pgPool = null;

// Mêmes tables dans les deux dialectes. Collision vérifiée : aucune entité
// du backend FasoFree ne s'appelle conversations / messages / memories.
const SQLITE_DDL = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL
      REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id, id);
  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    conversation_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

const PG_DDL = `
  CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    updated_at TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
  );
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL
      REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id, id);
  CREATE TABLE IF NOT EXISTS memories (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    conversation_id INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
  );
`;

async function initDatabase() {
  if (usePg) {
    const { Pool, types } = require("pg");
    // int8 (COUNT) → nombre JS ; timestamp sans fuseau → texte brut UTC
    // (sinon node-pg fabrique des objets Date dans le fuseau local)
    types.setTypeParser(20, (v) => parseInt(v, 10));
    types.setTypeParser(1114, (v) => v);
    // Fuseau UTC posé au démarrage de la connexion (paramètre server-side,
    // sans requête parallèle → pas de dépréciation pg)
    let conn = process.env.DATABASE_URL;
    if (!/options=/.test(conn)) {
      conn += (conn.includes("?") ? "&" : "?") + "options=-c%20TimeZone%3DUTC";
    }
    pgPool = new Pool({
      connectionString: conn,
      // Render impose TLS, un serveur local n'en a pas
      ssl: /localhost|127\.0\.0\.1|::1/.test(process.env.DATABASE_URL)
        ? false
        : { rejectUnauthorized: false }
    });
    await pgPool.query(PG_DDL);
  } else {
    const { DatabaseSync } = require("node:sqlite");
    fs.mkdirSync(DATA_DIR, { recursive: true });
    sqlite = new DatabaseSync(path.join(DATA_DIR, "agent.db"));
    sqlite.exec(SQLITE_DDL);
    sqlite.exec("PRAGMA foreign_keys = ON;");
  }
}

/* Couche d'accès unifiée : mêmes requêtes SQL (?) dans les deux dialectes */

function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function dbAll(sql, params = []) {
  if (usePg) return (await pgPool.query(toPgPlaceholders(sql), params)).rows;
  return sqlite.prepare(sql).all(...params);
}

async function dbGet(sql, params = []) {
  if (usePg) {
    const r = await pgPool.query(toPgPlaceholders(sql), params);
    return r.rows[0] || null;
  }
  return sqlite.prepare(sql).get(...params) || null;
}

async function dbRun(sql, params = []) {
  if (usePg) {
    const r = await pgPool.query(toPgPlaceholders(sql), params);
    return { rowCount: r.rowCount };
  }
  const info = sqlite.prepare(sql).run(...params);
  return { rowCount: Number(info.changes) };
}

const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TITLE_LENGTH = 60;

function readJson(fileName) {
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

// Données réelles injectées dans le prompt système pour éviter les chiffres inventés.
function buildBusinessContext() {
  const data = readJson("fasofree-data.json");
  const restaurants = readJson("restaurants.json");
  const clients = readJson("clients.json");

  const parts = [];

  if (data) {
    parts.push(`Informations actuelles de FasoFree :\n${JSON.stringify(data, null, 2)}`);
  } else {
    parts.push(
      "Informations actuelles de FasoFree : AUCUN fichier fasofree-data.json trouvé. " +
        "Ne donne aucun chiffre, demande à l'utilisateur de fournir la ville, le budget et les zones."
    );
  }

  if (restaurants && Array.isArray(restaurants)) {
    parts.push(
      `Prospects restaurants (${restaurants.length} au total, statuts : "À contacter", "Contacté", ` +
        `"Intéressé", "Démo prévue", "Inscrit", "Refus temporaire", "À relancer") :\n` +
        JSON.stringify(restaurants, null, 2)
    );
  }

  if (clients && Array.isArray(clients)) {
    parts.push(`Prospects clients (${clients.length} au total) :\n${JSON.stringify(clients, null, 2)}`);
  }

  return parts.join("\n\n");
}

const SYSTEM_PROMPT = `
Tu es FasoFree Launch Director, le conseiller stratégique du lancement de l'application FasoFree.

FasoFree n'est pas encore officiellement active. Ta mission est d'aider la direction à recruter des restaurants, des livreurs et des clients.
Tes 4 domaines : (1) acquisition des restaurants, (2) acquisition des clients, (3) stratégie de lancement, (4) suivi des prospects.

Tu dois :
- proposer des actions concrètes et réalistes ;
- donner des messages prêts à envoyer (WhatsApp, Facebook, TikTok, SMS) ;
- prioriser les restaurants et les quartiers ;
- créer des offres de lancement ;
- préparer des campagnes et un calendrier de contenu ;
- suivre les prospects et planifier les relances ;
- respecter le budget disponible ;
- distinguer clairement les FAITS, les HYPOTHÈSES et les RECOMMANDATIONS ;
- toujours proposer une prochaine action claire.

Pour chaque recommandation, indique :
1. objectif ; 2. cible ; 3. message ou action ; 4. coût estimé ; 5. délai ; 6. résultat attendu ; 7. indicateur de réussite.

Règles strictes :
- Ne prétends jamais qu'une campagne a fonctionné si aucune donnée ne le confirme.
- Demande une validation humaine avant toute dépense, publication ou modification commerciale.
- N'invente jamais de statistiques. Si une donnée manque, dis-le explicitement et propose une hypothèse.
- Réponds en français, simplement et de façon structurée (listes, pas de longs pavés).
- Utilise les données ci-dessous comme seule source de vérité. Ne crée jamais de chiffres absents de ces données.

## Mémoire du business plan

Déjà retenu (décisions, offres, budgets, zones, prospects clés) :
${"{{MEMORY_CONTEXT}}"}

Règle mémoire : quand l'utilisateur te demande de retenir quelque chose (« retiens », « note », « souviens-toi ») ou qu'une décision stable du plan est actée, termine TA RÉPONSE par une ligne au format exact, sans autre commentaire :

[RETIENS] <phrase courte en français>

Une ligne par élément. Ces lignes sont extraites automatiquement et ajoutées au business plan : ne les explique pas dans le corps de ta réponse.

${"{{BUSINESS_CONTEXT}}"}
`;

async function buildSystemPrompt() {
  return SYSTEM_PROMPT
    .replace("{{BUSINESS_CONTEXT}}", buildBusinessContext())
    .replace("{{MEMORY_CONTEXT}}", await buildMemoryContext());
}

/* ------------------------------------------------------------------ */
/* Mémoire du business plan                                            */
/* ------------------------------------------------------------------ */

function normalizeMemory(text) {
  return String(text).replace(/\s+/g, " ").trim().toLowerCase();
}

// Mots/nombres seuls : la ponctuation (« lancement : ») ne doit pas fausser la similarité
function memoryTokens(text) {
  return normalizeMemory(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean);
}

// Dédoublonnage par recouvrement de tokens (Jaccard) : attrape aussi les
// reformulations (« retiens que X » vs marqueur [RETIENS] réécrit par le modèle)
async function memoryExists(content) {
  const tokens = new Set(memoryTokens(content));
  if (tokens.size < 3) return false;
  const rows = await dbAll("SELECT content FROM memories");
  return rows.some((r) => {
    const rt = new Set(memoryTokens(r.content));
    if (rt.size < 3) return false;
    let inter = 0;
    for (const w of tokens) if (rt.has(w)) inter++;
    const union = tokens.size + rt.size - inter;
    return inter / union >= 0.7;
  });
}

// Ajoute une note si elle est assez longue et pas déjà présente (dédoublonnage)
async function addMemory(content, conversationId) {
  const clean = String(content).replace(/\s+/g, " ").trim().slice(0, 300);
  if (clean.length < 8) return null;
  if (await memoryExists(clean)) return null;
  const row = await dbGet(
    "INSERT INTO memories (content, conversation_id) VALUES (?, ?) RETURNING id",
    [clean, conversationId || null]
  );
  return { id: Number(row.id), content: clean };
}

async function buildMemoryContext() {
  const rows = await dbAll(
    "SELECT content FROM memories ORDER BY id DESC LIMIT 40"
  );
  if (!rows.length) return "Aucune décision mémorisée pour l'instant.";
  return rows
    .reverse()
    .map((r, i) => `${i + 1}. ${r.content}`)
    .join("\n");
}

// Extrait les marqueurs [RETIENS] de la réponse du modèle (affichage propre)
function extractRetiens(answer) {
  const added = [];
  const clean = answer
    .replace(/^\s*\[RETIENS\]\s*(.+?)\s*$/gim, (m, p1) => {
      added.push(p1.trim());
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { clean, added };
}

function truncateError(message) {
  return String(message).slice(0, 500);
}

function makeTitle(message) {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > MAX_TITLE_LENGTH ? clean.slice(0, MAX_TITLE_LENGTH - 1) + "…" : clean;
}

/* ------------------------------------------------------------------ */
/* Authentification optionnelle (APP_PASSWORD sur l'hébergement)       */
/* ------------------------------------------------------------------ */

const APP_PASSWORD = process.env.APP_PASSWORD || "";
const AUTH_COOKIE = "ff_agent";

// Même fonction pour le mot de passe réel (comparaison) et pour l'empreinte
// (valeur du cookie) : le cookie n'autorise jamais à retrouver le mot de passe
function passwordHash(value) {
  return crypto.createHash("sha256").update("fasofree-agent::v1::" + value).digest("hex");
}

function authFingerprint() {
  return passwordHash(APP_PASSWORD);
}

// Anti force-brute : 5 essais échoués puis 15 minutes de blocage par IP
const loginFails = new Map();

function loginBlocked(ip) {
  const rec = loginFails.get(ip);
  return Boolean(rec && rec.count >= 5 && rec.resetAt > Date.now());
}

function registerLoginFail(ip) {
  const now = Date.now();
  let rec = loginFails.get(ip);
  if (!rec || rec.resetAt <= now) {
    rec = { count: 0, resetAt: now + 15 * 60 * 1000 };
  }
  rec.count += 1;
  loginFails.set(ip, rec);
  if (loginFails.size > 5000) loginFails.clear();
}

// Toute l'API exige le cookie de session (sauf /api/auth, en clair)
app.use("/api", (req, res, next) => {
  if (!APP_PASSWORD) return next();
  if (req.path === "/auth") return next();
  const cookies = req.headers.cookie || "";
  const match = cookies.match(
    new RegExp("(?:^|;\\s*)" + AUTH_COOKIE + "=([a-f0-9]{64})")
  );
  if (match && match[1] === authFingerprint()) return next();
  res.status(401).json({ error: "Authentification requise." });
});

app.post("/api/auth", (req, res) => {
  if (!APP_PASSWORD) return res.json({ ok: true, passwordRequired: false });

  const ip = req.ip || "?";
  if (loginBlocked(ip)) {
    return res.status(429).json({ error: "Trop de tentatives. Réessayez dans 15 minutes." });
  }

  const password = req.body && req.body.password;
  // Comparaison sur les empreintes SHA-256 : toujours des buffers de 64 octets,
  // durée constante, aucune fuite de longueur
  const ok =
    typeof password === "string" &&
    crypto.timingSafeEqual(
      Buffer.from(passwordHash(password)),
      Buffer.from(authFingerprint())
    );

  if (!ok) {
    registerLoginFail(ip);
    return res.status(401).json({ error: "Mot de passe incorrect." });
  }

  loginFails.delete(ip);
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${AUTH_COOKIE}=${authFingerprint()}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict${secure}`
  );
  res.json({ ok: true, passwordRequired: true });
});

/* ------------------------------------------------------------------ */
/* API : conversations                                                 */
/* ------------------------------------------------------------------ */

app.get("/api/status", async (req, res) => {
  const row = await dbGet("SELECT COUNT(*) AS n FROM conversations");
  res.json({
    hasApiKey: Boolean(process.env.OPENROUTER_API_KEY),
    model: process.env.OPENROUTER_MODEL || "openrouter/free",
    hasData: readJson("fasofree-data.json") !== null,
    restaurants: (readJson("restaurants.json") || []).length,
    clients: (readJson("clients.json") || []).length,
    conversations: row ? row.n : 0
  });
});

// Liste des conversations (titre + dates, sans les messages)
app.get("/api/conversations", async (req, res) => {
  const rows = await dbAll(
    `SELECT c.id, c.title, c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS messages
     FROM conversations c
     ORDER BY c.updated_at DESC, c.id DESC
     LIMIT 100`
  );
  res.json({ conversations: rows });
});

// Messages d'une conversation
app.get("/api/conversations/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Identifiant invalide." });
  }
  const conv = await dbGet("SELECT id, title FROM conversations WHERE id = ?", [id]);
  if (!conv) return res.status(404).json({ error: "Conversation introuvable." });
  const messages = await dbAll(
    "SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC",
    [id]
  );
  res.json({ conversation: conv, messages });
});

// Suppression d'une conversation (et ses messages en cascade)
app.delete("/api/conversations/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Identifiant invalide." });
  }
  const conv = await dbGet("SELECT id FROM conversations WHERE id = ?", [id]);
  if (!conv) return res.status(404).json({ error: "Conversation introuvable." });
  await dbRun("DELETE FROM conversations WHERE id = ?", [id]);
  res.json({ ok: true });
});

// (héritage) : vidait l'historique mémoire — l'historique est désormais en base
app.post("/api/reset", (req, res) => {
  res.json({ ok: true, message: "Historique géré en base de données." });
});

/* ------------------------------------------------------------------ */
/* API : mémoire du business plan                                      */
/* ------------------------------------------------------------------ */

app.get("/api/memories", async (req, res) => {
  const rows = await dbAll(
    "SELECT id, content, conversation_id, created_at FROM memories ORDER BY id DESC LIMIT 200"
  );
  res.json({ memories: rows });
});

// Ajout manuel d'une note
app.post("/api/memories", async (req, res) => {
  const content = req.body && req.body.content;
  if (!content || typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "Le contenu est obligatoire." });
  }
  if (content.length > 300) {
    return res.status(400).json({ error: "Note trop longue (300 caractères maximum)." });
  }
  const saved = await addMemory(content, null);
  if (!saved) return res.json({ ok: false, duplicate: true });
  res.json({ ok: true, memory: saved });
});

app.delete("/api/memories/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Identifiant invalide." });
  }
  const m = await dbGet("SELECT id FROM memories WHERE id = ?", [id]);
  if (!m) return res.status(404).json({ error: "Note introuvable." });
  await dbRun("DELETE FROM memories WHERE id = ?", [id]);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* API : chat                                                          */
/* ------------------------------------------------------------------ */

app.post("/api/chat", async (req, res) => {
  let userMsgId = null;
  try {
    const message = req.body && req.body.message;
    const conversationId = req.body && req.body.conversationId;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Le message est obligatoire." });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res
        .status(400)
        .json({ error: `Message trop long (${message.length} caractères maximum : ${MAX_MESSAGE_LENGTH}).` });
    }
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({
        error:
          "Clé OpenRouter manquante. Ouvrez fasofree-agent/.env et renseignez OPENROUTER_API_KEY= votre_clé (créez-la sur openrouter.ai > Keys)."
      });
    }

    // Conversation existante ou nouvelle
    let convId = Number.isInteger(conversationId) ? conversationId : null;
    if (convId !== null) {
      const exists = await dbGet("SELECT id FROM conversations WHERE id = ?", [convId]);
      if (!exists) convId = null;
    }
    if (convId === null) {
      const created = await dbGet(
        "INSERT INTO conversations (title) VALUES (?) RETURNING id",
        [makeTitle(message)]
      );
      convId = Number(created.id);
    }

    // Sauvegarde du message utilisateur
    const insertUser = await dbGet(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?) RETURNING id",
      [convId, message.trim()]
    );
    userMsgId = Number(insertUser.id);

    // Historique : derniers messages de CETTE conversation
    const historyRows = (
      await dbAll(
        "SELECT role, content FROM messages WHERE conversation_id = ? AND id <= ? ORDER BY id DESC LIMIT ?",
        [convId, userMsgId, MAX_HISTORY_MESSAGES]
      )
    ).reverse();

    const apiMessages = [
      { role: "system", content: await buildSystemPrompt() },
      ...historyRows.map((r) => ({ role: r.role, content: r.content }))
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "FasoFree Launch Director"
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openrouter/free",
        messages: apiMessages,
        temperature: 0.3
      })
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      // Échec : on retire le message utilisateur pour ne pas polluer l'historique
      if (userMsgId !== null) await dbRun("DELETE FROM messages WHERE id = ?", [userMsgId]);

      const errCode = data && data.error && data.error.code;
      if (response.status === 429 || errCode === 429) {
        return res.status(429).json({
          error:
            "Quota gratuit OpenRouter dépassé (50 requêtes/jour par défaut). Réessayez plus tard ou achetez 10 crédits OpenRouter pour passer à 1000/jour."
        });
      }
      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({
          error: "Clé OpenRouter invalide ou expirée. Vérifiez OPENROUTER_API_KEY dans fasofree-agent/.env."
        });
      }
      if (response.status === 402) {
        return res.status(402).json({ error: "Crédit OpenRouter insuffisant pour ce modèle." });
      }
      return res
        .status(response.status)
        .json({ error: `Erreur OpenRouter : ${truncateError((data && data.error && data.error.message) || "réponse invalide")}` });
    }

    const answer =
      data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : null;

    if (!answer) {
      if (userMsgId !== null) await dbRun("DELETE FROM messages WHERE id = ?", [userMsgId]);
      return res.status(502).json({ error: "Réponse vide du modèle. Réessayez." });
    }

    // Mémoire : si l'utilisateur a explicitement demandé de retenir, on garde
    // SES mots (une seule note, jamais deux reformulations du même fait) ;
    // sinon on prend les marqueurs [RETIENS] émis par le modèle.
    const { clean, added } = extractRetiens(answer);
    const explicit = message.match(
      /^\s*(?:retiens|retien|note|souviens[-\s]?toi|mémorise|memorise)\b\s*(?:que|:|,|-)?\s*(.{8,})/i
    );
    const candidates = explicit ? [explicit[1]] : added;

    const savedMemories = [];
    for (const c of candidates) {
      const saved = await addMemory(c, convId);
      if (saved) savedMemories.push(saved);
    }

    const finalAnswer = clean || "C'est noté dans le business plan.";

    // Sauvegarde de la réponse + mise à jour de la date de la conversation
    await dbRun(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'assistant', ?)",
      [convId, finalAnswer]
    );
    await dbRun(
      "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [convId]
    );

    const conv = await dbGet("SELECT id, title FROM conversations WHERE id = ?", [convId]);
    res.json({
      answer: finalAnswer,
      conversationId: conv.id,
      title: conv.title,
      memories: savedMemories
    });
  } catch (error) {
    console.error(error);
    if (userMsgId !== null) {
      try { await dbRun("DELETE FROM messages WHERE id = ?", [userMsgId]); } catch {}
    }
    res.status(500).json({
      error: "Erreur de communication avec OpenRouter. Vérifiez votre connexion internet puis réessayez."
    });
  }
});

async function start() {
  await initDatabase();
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("ATTENTION : OPENROUTER_API_KEY manquante — le chat renverra une erreur.");
  }
  if (!APP_PASSWORD) {
    console.log("Authentification : DÉSACTIVÉE (variable APP_PASSWORD absente).");
  }
  console.log(
    usePg
      ? "Base de données : PostgreSQL (" + new URL(process.env.DATABASE_URL).host + ")"
      : "Base de données : SQLite locale (" + path.join(DATA_DIR, "agent.db") + ")"
  );
  app.listen(PORT, () => {
    console.log(`FasoFree Launch Director disponible sur http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Échec du démarrage :", err.message || err);
  if (usePg) {
    let host = "(URL illisible)";
    try {
      host = new URL(process.env.DATABASE_URL).host;
    } catch {}
    if (err && err.code === "ENOTFOUND") {
      console.error(
        `→ Hôte PostgreSQL introuvable : « ${host} ».\n` +
          "  Causes fréquentes : URL incomplète (il manque .internal ou .region.render.com), " +
          "URL Internal depuis un autre compte/région, ou base supprimée/suspendue.\n" +
          "  Correction : Environment → DATABASE_URL = URL EXTERNE complète (postgresql://user:pass@hote:5432/base), " +
          "ou retirez DATABASE_URL pour repasser en SQLite local."
      );
    } else if (err && (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT" || err.code === "ENOTFOUND" || err.code === "28P01" || err.code === "28000")) {
      console.error(
        "→ PostgreSQL injoignable ou identifiants refusés. Vérifiez DATABASE_URL " +
          "(URL EXTERNE complète) et que la base existe toujours."
      );
    }
  }
  process.exit(1);
});
