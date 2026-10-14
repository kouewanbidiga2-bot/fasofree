# FASOFREE — TikTok Ad « Hook→Zoome→P2P→CTA » (34 s, 9:16)

Art direction premium. Contraintes strictes :
- **Seules les VRAIES captures de l'app sont utilisées** dans les écrans (jamais d'UI générée) : `home.png`, `resto.png` (menu Chitir Chicken), `p2p.png`, `search.png`, `auth.png`.
- Cartes panier/paiement/suivi = **auth protégé** → dessinées en style UI FasoFree avec **données réelles** (Chitir Chicken « Poulet Entier » 5 500 FCFA, panier total 8 800 FCFA) + vraies photos produits (`chitirchiken.jpeg`, `gusto.jpeg`).
- Fond & mockup = générés (Midjourney/DALL·E) ; la musique sera ajoutée **nativement dans TikTok/IG** (son Trend) → piste audio laissée vide.

---

## 1. SCRIPT VOIX OFF — ELEVENLABS (calibré à la seconde)

Voix : **Adam (masculin, dynamique)** — backups : « Dominic » ou « Rachel ». Réglages : Stability 55 · Similarity 90 · Style 0.40 · Speaker Boost ON · Vitesse 1.08. Marquer les respirations par `…` et virgules.

| # | Time-In | Durée | Time-Out | Script exact (avec respiration) |
|---|---|---|---|---|
| S1 | 0,5 s | 3,9 s | 4,4 s | « T'as faim… mais t'as la flemme de bouger ? … Regarde ça. » |
| S2 | 4,6 s | 6,9 s | 11,5 s | « Avec FasoFree, commande ton poulet entier, à seulement cinq mille cinq cents francs, … direct depuis ton canapé. » |
| S3 | 11,6 s | 7,2 s | 18,8 s | « Tu valides ton panier… tu paies en un clic avec tes potes, grâce au P2P… et c'est déjà en route. » |
| S4 | 20,5 s | 4,4 s | 24,9 s | « Télécharge FasoFree maintenant. … Le lien est dans la bio ! » |

> Rythme final testé sur ElevenLabs avec le texte exact ; ajustement ±0,3 s possible → recentrer les timings de la timeline ci-dessous si besoin.

---

## 2. TIMELINE VISUEL + TEXTE À L'ÉCRAN (34,0 s · 60 fps)

| Time | Scène | Visuel (captures RÉELLES) | Texte à l'écran |
|---|---|---|---|
| 0,0–3,2 | **S1 HOOK** | BG lifestyle (Midjourney #1) ; zoom rapide vers logo FasoFree (icône réelle) qui « pop » en 3D | « Envie d'un bon plan repas sans te ruiner ? » lettre par lettre (0,8→2,0) |
| 3,2–10,0 | **S2 SOLUTION** | Mockup 3D pivot face caméra ; écran = **`resto.png`** ; doigt « Tap » sur la rangée Resto ; swipe fluide vers le produit « Poulet Entier » | Sticker « POULET ENTIER » (6,0) + **« 5 500 FCFA » pop 3D + brillance** (6,8) |
| 10,0–19,3 | **S3 PREUVE / P2P** | Split : haut = carte Panier réelle (total **8 800 FCFA**) ; bas = **`p2p.png`** qui se valide + coche verte brillante | « Paiement 100% Sécurisé 🔒 » (11,2) · « 8 800 FCFA » (13,4) · « PAIEMENT VALIDÉ ✓ » (15,8) |
| 19,3–34,0 | **S4 CTA** | Téléphone se range ; logo FasoFree géant ; badges App Store / Google Play ; barre de recherche tape « FasoFree » | « Téléchargez maintenant » (20,8) · badges (24,2) · tape « FasoFree » (22,2–26,4) · « La livraison. 100% Burkina Faso. » (29,0) |

**Mouvement caméra** : pan/tilt léger (3 à 6°) sur chaque scène, fondu d'écran du mockup avec **spring (overshoot 12 %)** aux chutes et **ease-in-out expo** aux entrées ; **motion blur** sur tous les swipes/zooms ≥ 300 px (ghosted 2–3 frames / subexposure 60 fps ; ffmpeg `minterpolate` si besoin).

---

## 3. PROMPTS IMAGES DE FOND (Midjourney v6 / DALL·E)

Suffixe commun : `--ar 9:16 --v 6 --style raw --q 2` (DALL·E : générer 1024×1792).

- **#1 Hook (lifestyle faim)**
  « Cinematic close-up of a young Black West African man in his 20s, hungry, hand on stomach, urban apartment at night, smartphone screen glow lighting his face, warm orange practical light, shallow depth of field, bokeh, editorial 35mm photography, rich orange and warm brown grade ›
- **#2 Salon (canapé, confort)**
  « Cozy modern African apartment at night, stylish orange sofa, warm golden lamps, a smartphone lying on the couch with a glowing vibrant orange food delivery app, warm cinematic orange-teal grade, dust particles in light, editorial photography »
- **#3 Fond premium (split écran P2P)**
  « Premium fintech ad background, vertical gradient deep charcoal to vibrant burnt orange, soft orange radial glow bottom, subtle gold dust particles, clean minimal, no text, no people, ultra smooth »
- **#4 End-card (CTA)**
  « Bold product launch end-card background, vibrant burnt orange to dark charcoal gradient, golden light rays from top, floating gold confetti bokeh, centered empty clean space in middle, premium tech, minimal, no text »

**Mockup 3D (à composer avec les captures réelles)** :
« Detached premium smartphone mockup, thin modern titanium frame, floating at 25-degrees dynamic perspective, glossy reflections, soft drop shadows, screen glowing ]green hot orange food app home UI, ultra realistic 3D render, studio light, clean edges, 9:16 »

> RÈGLE ABSOLUE : le contenu de l'écran du mockup est TOUJOURS remplacé par les captures réelles (`home.png`, `resto.png`, `p2p.png`…). Le mockup ne sert que de coquille/bézier.

---

## 4. TIMELINE SFX EXACTE

Whoosh (W) = souffle montant, bande 400→6000 Hz. Pour un rendu local : bruit blanc + filtrage passe-bande glissant + fade.

| Time | SFX | Action |
|---|---|---|
| 0,00–0,60 | RIS | Riser sub (80 Hz) d'intro |
| 0,35–1,10 | **W deep** | Whoosh profond — entrée logo |
| 0,55 | **TH+POP** | Impact logo (55 Hz) + pop organique |
| 0,80 / 1,10 / 1,40 / 1,70 / 2,00 | TX | « Pop » sec par mot du titre |
| 2,80–3,40 | **W** | Transition S1→S2 |
| 3,05 | FWIP+SW | Rotation 3D du téléphone + glide haut |
| 3,40 | TICK | Allumage écran (click) |
| 4,55 | **TAP** | Doigt sur « Resto » |
| 5,60 | SW | Glisse vers le produit (whoosh mid) |
| 6,80 | **POP+SP** | Prix « 5 500 FCFA » sort de l'écran + sparkle |
| 8,20 | TAP | Ligne produit |
| 9,40–10,10 | **W** | Transition S2→S3 |
| 10,20 | SW | Split-screen slide |
| 11,40 / 12,00 / 12,60 | BLIP ×3 | Lignes du panier ajoutées (stagger) |
| 13,40 | POP+SP | Total « 8 800 FCFA » |
| 15,80 | **DING** | Envoi P2P + coche verte + chime de confirmation + confettis TING |
| 19,30–20,00 | **W** | Transition S3→S4 |
| 20,00–20,80 | RIS | Riser vers CTA |
| 20,80 | TH | Chute du logo + shimmer du badge |
| 22,10–26,40 | KT ×6 | Clics de clavier (tape « FasoFree ») |
| 24,30 / 24,55 | POP | Badges App Store / Google Play |
| 27,50 | ST | End-card sting + réverb courte |
| 33,60–34,00 | W out | Whoosh de sortie (ou loop) |

---

## 5. RECETTES SFX (synthèse locale ffmpeg, si rendu maison)

- **Whoosh** : `anoisesrc=color=white,bandpass=f=4000:w=2000` + sweep `asendcmd` 400→6000 Hz, fade 0.35/0.5
- **Pop** : sine 180 Hz, ADSR attack 1 ms / decay 90 ms
- **Ding/Ting** : sine 1200 Hz + 3e harmonique, decay 400 ms, gain doux
- **Blip** : square 880 Hz 60 ms, gain −12 dB
- **Sparkle** : arpège sine 2,5→5 kHz ×5, 250 ms
- **Thump** : sine 55 Hz 120 ms, snap

Mix final : SFX −10 dB sous la VO (VO = 0 dB), `sidechaincompress` pas nécessaire (piste musique vide). Targets : VO I=−16 LUFS, SFX I=−30.