# PROMPT — Recréer à l'identique : « FasoFree — 2 vidéos publicitaires verticales »

Tu es un expert video (motion design + montage). Produis EXACTEMENT les 2 vidéos suivantes, pixel pour pixel, en respectant strictement : timings, textes, couleurs, polices, animations, son et codec. Aucune créativité : tout est spécifié.

---

## 1. SPEC TECHNIQUE COMMUNE

- Canvas vertical **1080×1920** (9:16), **25 fps**, codec **H.264 / yuv420p**, **+faststart**, CRF 18 (preset slow), audio **AAC 192 kbps, 48 kHz, stéréo**.
- Rendu par frames séquentielles : `f00000.png … f00849.png` (vidéo 1), `f00000.png … f02249.png` (vidéo 2), puis encodage ffmpeg avec `-framerate 25 -i "f%05d.png"`.
- Anti-aliasing activé, interpolation bicubic haute qualité, text rendering : AntiAliasGridFit.
- Toute valeur alpha (fondu) est focalisée sur le temps `t` en secondes (frame / 25).

### Palette
| Rôle | Hex |
|---|---|
| Orange brand | `#C1652E` |
| Crème | `#FBF8F3` |
| Encre | `#29231E` |
| Or logo | `#D4AF37` |
| Or clair chip | `#C9A961` |
| Sombre | `#1E1E1E` |
| Blanc | `#FFFFFF` |
| MTN MoMo | `#FFCB05` |
| Orange Money | `#FF7900` |
| Wave | `#1DC8FF` |
| Vert succès | `#2E8B57` |

### Polices
« Segoe UI » : Regular & Bold. Tailles en pixels utilisées : 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 52, 56, 60, 120, 150.

### Assets source (vrais écrans de l'app live)
Icône app (carré sombre `#0D0D0D` + épis orange `#C1652E`), Home, Menu restaurant « Chitir Chicken » (Kamboinsin), Création de compte, Connexion/Auth, Envoi colis (P2P). Références : `home.png`, `resto.png`, `register.png`, `auth.png`, `search.png`, `p2p.png` (tous 390×844), `icon_big.png` (1080×1080). Photos produits : `chitirchiken.jpeg`, `gusto.jpeg`.

### Composant « téléphone » (réutilisé)
- Écran arrondi : coins rayon = 10 % de la largeur, clip sur l'image du screenshot.
- Bezel `#121212` dépassant de ~7 px autour de l'écran, ombre portée noire a≈80 décalée (x+10, y+16).
- Notch : pilule `#121212` 140×22, centrée en haut, à +22 px du haut de l'écran.
- Zoom éventuel appliqué depuis le centre de l'écran.
- Dimension de référence : largeur `fw`, hauteur `fh = fw × 844/390`, positionnée par centre `(cx, cy)`.
- Conversion écran→dessin : `sx = cx - fw/2 + x_screenshot * fw/390` ; `sy = cy - fh/2 + y_screenshot * fh/844`.

---

## 2. VIDÉO 1 — « FasoFree — Présentation » (34,0 s = 850 frames)

VOIX OFF (voix féminine française, énergique, Row~1) — texte exact :
- c1 « FasoFree. La livraison, cent pour cent burkinabè. » @ 0,6 s
- c2 « Commandez vos plats préférés en quelques clics. » @ 6,4 s
- c3 « Tous vos restaurants de Ouagadougou, à portée de main. » @ 11,8 s
- c4 « Envoyer un colis ? FasoFree s'occupe de tout. » @ 18,3 s
- c5 « Payez en Mobile Money. Sécurisé, garanti. » @ 23,3 s
- c6 « Téléchargez FasoFree. Tout votre quartier, livré. » @ 27,8 s

### S1 [0,0–6,0] Icône + wordmark — fond dégradé `#1C150E → #0E0B08` (haut) vers `#7A4421 → #C1652E` (bas), pulsation lente (période ~9 s). 30 particules dorées/oranges montantes. 
- `t≤0.9` : fondu+zoom du titre « FasoFree » (Segoe UI Bold 150 px, or `#D4AF37`, ombre noire) centré (540, 430).
- « MARKETPLACE & LIVRAISON » (Bold 56, blanc) y=560 ; « Ouagadougou » (Regular 40, blanc a=0.6) y=640.
- Carte icône : carré blanc arrondi (rayon ~40) 360×360 centré (540, 980), marge 18 ; icône l'app 360×360 par-dessus, fondu + scale 0.9→1.0 entre t=0.6 et t=1.7.
- Chip « 100% Burkina Faso · fait main » (or clair bg, encre, Bold 38) y=1330 apparaît t=2.2.
- Texte « Votre marketplace locale, du marché à votre porte. » (Regular 30, blanc) y=1490, t≥2.2.

### S2 [6,0–11,5] Home — fond crème (haut `#FBF8F3→#EFE3CC`, bas `#F3E3CB→#D8B98A`), 14 particules orange très discrètes.
- Téléphone `home.png`, cx=540, cy=1050, fw=440, slide-up depuis y+620 avec ease-out quad (3 s).
- Chip orange « Commandez vos plats préférés » (blanc, Bold 34, pads 60×22) y=300, t≥6.6.
- Sous-titre « En quelques clics, livré à votre porte » (Regular 38, encre) y=380, t≥7.3.
- Chip blanc « Cuisine locale & internationale » y=1655, t≥7.3.

### S3 [11,5–18,0] Menu — fond sombre chaud (haut `#2B211A→#1B150F`, bas `#5D3419→#8A4F24`).
- Téléphone `resto.png`, cx=540, cy=1010, fw=440, slide depuis +60, zoom continu 1.0→1.09 (push-in 6 s).
- « Vos restaurants préférés » (Bold 46, or) y=330 ; « Centaines de plats, toute la ville de Ouaga » (Regular 36, blanc) y=410.
- 2 mini-cartes flottantes : photo `gusto.jpeg` (230×200 blanc r26) à (140,1470) + label « Gusto » ; `chitirchiken.jpeg` à (750,1570) + label « Chitir » ; oscillation verticale ±18 px, fréquences 2.2 / 1.7 rad/s.

### S4 [18,0–23,0] P2P — fond crème.
- Téléphone `p2p.png`, slide depuis x−620 (3 s), cx=540, cy=1020, fw=440.
- « Besoin d'envoyer un colis ? » (Bold 46, orange) y=330 ; « FasoFree s'occupe de tout » (Regular 36, encre) y=410.
- Chip orange « Course rapide · Livraison 24/7 » y=1580, t≥19.5.

### S5 [23,0–27,5] Paiement — fond sombre (`#1E1A16→#141110` / `#3A2415→#241308`), 22 particules or.
- « Payez en Mobile Money » (Bold 46, or) y=340.
- 3 pilules blanches 360×96 (rx=48), bord `#E8DDCB`, rondelle couleur 60×60 à gauche, nom Bold 34 encre centré : « MTN MoMo » y=640 (arrivée t=23.6, rebond), « Orange Money » y=780 (t=24.3), « Wave » y=920 (t=25.0).
- Bouclier vert `#2E8B57` avec liseré `#7FBF8F` et coche blanche, centré (540,1280) échelle 7, t≥25.9.
- « Sécurisé & 100% garanti » (Bold 40, blanc) y=1560, t≥26.4.

### S6 [27,5–34,0] CTA — fond orange vif (haut `#C1652E→#A95320`, bas `#7A3D17→#4C2410`), 26 particules or.
- Icône l'app 300×300 sur carte blanche (marge 15, r=34) à (540,330), scale 0.8→1.0.
- « FasoFree » (Bold 150, or) y=760 ; « Téléchargez l'application » (Bold 52, blanc) y=890.
- 2 pilules blanches 500×110 r=18 : « Télécharger sur / Google Play » y=1150 (t=29.0) ; « Télécharger sur / App Store » y=1320 (t=29.7).
- « Tout votre quartier, livré à votre porte. » (Regular 40, blanc) y=1580 ; « www.fasofree.site » (Regular 32, or) y=1660 — t≥31.5.

---

## 3. VIDÉO 2 — « FasoFree — Tutoriel créer son compte et commander » (90,0 s = 2250 frames)

VOIX OFF — texte exact :
- t1 « Bienvenue dans le tutoriel FasoFree. Nous allons créer votre compte, puis commander votre premier repas. » @ 0,8 s
- t2 « Ouvrez l'application. En haut à droite, touchez Connexion. » @ 10,5 s
- t3a « Choisissez créer un compte, puis le profil client. » @ 16,0 s
- t3b « Remplissez votre nom, votre email, votre téléphone, puis créez votre mot de passe. » @ 21,0 s
- t4a « Validez votre compte avec le code reçu par WhatsApp ou par SMS. » @ 35,5 s
- t4b « Félicitations. Votre compte est prêt. » @ 40,0 s
- t5 « Retournez à l'accueil, et choisissez votre restaurant préféré. » @ 42,8 s
- t6a « Chitir Chicken, par exemple. Sélectionnez votre plat, comme le poulet entier. » @ 51,0 s
- t6b « Appuyez sur Ajouter au panier. » @ 58,5 s
- t7 « Vérifiez votre panier, choisissez la livraison, puis payez en Mobile Money. » @ 63,0 s
- t8 « Suivez votre livreur en temps réel, jusqu'à votre porte. Bon appétit ! » @ 74,5 s

Composants dessinés (style de l'app) :
- **Chip d'étape** : carte blanche 760×92 r=46, cercle numéroté 60×60 vert `#2E8B57` (si fini) ou orange `#C1652E`, texte Bold 34 gris `#3A3A3A`.
- **Panier** : carte blanche 560×620 r=34, titre « Votre panier » Bold 42 ; 3 lignes (h=92, fond `#F5EFE4`, r=22) soulignées en cascade (délai 0,18 s/ligne) :
  1. miniature `chitirchiken.jpeg` 46×46 + « Chitir Chicken » (Regular 26, orange) + « Poulet Entier (Chitir) » (Bold 30) + « 5 500 FCFA » (Bold 30, `#B85B1F`) ;
  2. « Riz gras + viande » + « 1 500 FCFA » ;
  3. « Bissap 1 L » + « 1 000 FCFA ».
  — **Total** « Total avec livraison » (Regular 28, gris) + « 8 800 FCFA » (Bold 46, encre) sur bande `#EAE0CB` (r=24), puis pilule **MTN MoMo** `#FFCB05` « PAYER ».
- **Suivi** : carte carte fond `#F3EBDD` 620×520 r=34 avec grille `#C9B694` a=40 ; route pointillée orange `#C1652E` (dash 1.4/0.7, trait 9, Bézier) du point vert « A » (40×40 rond, r=20, à x+70 y+400) vers « Vous » (pastille blanche « Vous » à x+460 y+60) ; livreur « C » orange pulsé (rayon 28–42) avec halo alpha 90–210 près du chemin ; étiquette ETA.

### S1 [0–10] Intro — même fond/particules que v1-S1.
- Icône 330×330 sur carte blanche à (540,420) ; « FasoFree » (Bold 150, or) y=950 ; chip or clair « TUTORIEL · en 2 minutes » (encre Bold 36) y=1120 (t=1.2) ; « Créer votre compte, puis commander votre premier repas » (Regular 40, blanc) y=1280 (t=2).

### S2 [10–15] Connexion — fond crème ; téléphone `home.png` cx=540 cy=1060 fw=440, slide-up (ease-out).
- Chip orange « Étape 1 — Connectez-vous » y=330 (t=10.6).
- Anneau de tap pulsé (2 cercles + pastille orange `#C1652E`, phase = 0.8×t) centré à l'écran (694,722) = bouton « Connexion » de la capture réelle, t≥11.6.
- « « Connexion », en haut à droite » (Bold 34, encre) y=1460.

### S3 [15–35] Création de compte — téléphone `register.png` cx=540 cy=1050 fw=430, léger slide.
- Chip « Étape 2 — Créer un compte » y=310.
- Étape 1 : « Choisissez le profil Client » y=1600 (t=16.5) ; Étape 2 : « Nom, email, téléphone, mot de passe » y=1720 (t=24.5).

### S4 [35–42] Validation — fond vert pâle (haut crème, bas `#E4EFDC→#BED9B8`), téléphone `auth.png` cx=540 cy=1040 fw=430.
- Chip vert « Étape 3 — Validez votre compte » y=320.
- « Code WhatsApp ou SMS reçu » (Bold 38, encre) y=1500 (t=38.4) ; « ✓ Compte validé » (Bold 60, vert) y=1640 (t=40).

### S5 [42–50] Choix restaurant — téléphone `home.png` cx=540 cy=1060 fw=440.
- Chip orange « Étape 4 — Choisissez votre restaurant » y=320.
- « Le meilleur de Ouagadougou, à un toucher » (Regular 34, encre) y=1500.
- Anneau de tap à l'écran (470,830) sur une mini-carte restaurant (t≥44).

### S6 [50–62] Menu & ajout — fond sombre chaud (comme v1-S3) ; téléphone `resto.png` cx=540 cy=1000 fw=430, slide depuis x−60, zoom 1.0→1.06 (6 s).
- Chip or clair « Étape 5 — Chitir Chicken, votre plat » y=300.
- Anneau de tap jaune `#FFCB05` à l'écran (505,842) = ligne « Poulet Entier » (t≥53.5).
- « « Poulet Entier », 5 500 FCFA » (Regular 34, blanc) y=1560.
- Gros bouton orange « + Ajouter au panier » (pads 90×40, blanc) y=1720 (t=58.5).

### S7 [62–74] Panier & paiement — fond crème ; carte Panier centrée (540,1020) échelle 1.12, apparition cascade 4 s.
- « Panier + paiement Mobile Money » (Bold 40, encre) y=310 ; « Simple et sécurisé » (Regular 34, orange) y=1480 (t=67).

### S8 [74–90] Suivi + CTA — fond orange vif + 20 particules or.
- « Suivi de commande en temps réel » (Bold 46, or) y=320.
- Carte Suivi (cx=540, cy=1150, échelle 0.9, fondu slide).
- Chip « Livreur en route · ETA 25 min » (or clair, encre) y=1520 (t=76.4) ; chip blanc « Bon appétit ! » y=1680 (t=78.5).
- « Téléchargez FasoFree maintenant » (Bold 40, blanc) y=1850 ; « www.fasofree.site » (Regular 30, or) y=1910 (t≥80).

---

## 4. SON

### Musique (synthèse, 44100 Hz stéréo, master : saturation tanh ×1.6, boucle)
Fond formulaire : pad (accords à 4 voix, lent fading, tremolo 0.6 Hz), pluck arp 16 pas, basse, shaker aléatoire, shimmer haut (upbeat seule). Fonds d'entrée/sortie 0.8 s / 1.0 s. Normalisation pic 0.82.
- **A** (vidéo 1) : 32 s, 120 BPM, accord signature crée, arp 16 pas, blancs riches, dominante high. Volume mix 0.34, fade in 1 s, fade out entre 29 s et 34 s.
- **B** (vidéo 2) : 62 s, 92 BPM, A2–F2–C3, arp plus doux. Volume mix 0.30, fade in 1.5 s, fade out entre 85 s et 90 s.

### Voix off
Voix féminine française dynamique (Row 1), post-process : highpass 95 Hz, lowpass 7800 Hz, compresseur (seuil −16 dB, ratio 3.2, attack 8 ms, release 140 ms, makeup 2 dB), loudnorm I=−16, TP=−1.5, LRA 11.

### Mix (ffmpeg)
- Chaque clip VO placé au temps donné via `adelay=ms|ms`.
- `amix inputs=N normalize=0`, `alimiter=limit=0.95`, `loudnorm I=−15 TP=−1.5 LRA 11`, `atrim` à la durée exacte de la vidéo.
- Sortie : AAC 48 kHz stéréo 192 kbps.

---

## 5. ENCODAGE (ffmpeg)

```
ffmpeg -y -framerate 25 -i "frames/f%05d.png" -i "audio.m4a" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart final.mp4
```

## 6. CONTRÔLE D'IDENTITÉ (à la virgule près)
- Durées : vidéo 1 = **34,000 s** ; vidéo 2 = **90,000 s**.
- Résolution/codec : 1080×1920, h264/yuv420p, 25 fps, AAC 48 kHz stereo.
- Vérification pixel près : comparer l'image-luminance moyenne (YAVG) par scène aux valeurs de référence : v1 t=5 → ~71, t=10 → ~196, t=32 → ~100 ; v2 t=3 → ~77, t=12 → ~195, t=30 → ~202, t=70 → ~212, t=88 → ~115.