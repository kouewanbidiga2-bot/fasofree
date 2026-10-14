# FasoFree Backend — Déploiement Oracle Cloud (PAYG) + PM2 + Caddy

Guide de bout en bout pour héberger l'API NestJS sur une VM **Oracle Cloud** en mode **Pay As You Go** (budget ≈ 0 $/mois), derrière **PM2** et un reverse proxy **Caddy** (HTTPS + WebSocket).

Le backend FasoFree est **stateless** : la base de données (Neon), Redis (Upstash), Cloudinary/Firebase restent chez leurs fournisseurs. On ne déploie ici que le serveur Node.

---

## Étape 0 — Compte Oracle : activer le PAYG + alerte de budget

1. Crée ton compte sur <https://www.oracle.com/cloud/free/> (carte bancaire exigée, ~1 $ bloqué puis restitué).
2. Dans la console : **hamburger ☰ → Billing & Cost Management → Account Management → Upgrade to Pay As You Go**. Aucun coût tant que tu restes dans les allocations gratuites.
3. **Budget :** ☰ → **Billing & Cost Management → Budgets → Create Budget**,
   - Target : `Compartment` (racine)
   - Amount : `$0.50` / mois, alertes à `80 %` et `100 %` (email).
   Cela te prévient si tu dépasses l'allocation (aucun risque de facture surprise).

---

## Étape 1 — Réseau (VCN) et Security List

1. ☰ → **Networking → Virtual cloud networks → Start VCN Wizard** → *Create VCN with Internet Connectivity* (nom : `fasofree-vcn`).
2. Clique sur la VCN créée, puis **Subnets** → clique sur le subnet `Public Subnet` → **Security List** (lien `fasofree-vcn-security-list-...`).
3. Ajoute ces **Ingress Rules** (statut d'origine TCP) :
   | Source | IP Protocol | Destination Port |
   |---|---|---|
   | `0.0.0.0/0` | TCP | `22` (SSH — déjà présent souvent) |
   | `0.0.0.0/0` | TCP | `80` (HTTP/Let's Encrypt) |
   | `0.0.0.0/0` | TCP | `443` (HTTPS) |
   | `0.0.0.0/0` | TCP | `3100` (optionnel : test direct avant Caddy) |

   Les sorties (egress) sont autorisées par défaut vers `0.0.0.0/0` → OK pour atteindre Neon, Upstash, Cloudinary, etc.

---

## Étape 2 — Réserver l'IP publique (gratuite, stable)

1. ☰ → **Networking → IP Management → Reserved Public IPs → Reserve Public IP** (inclus Always Free, 0 $).
2. Écris l'IP réservée quelque part : elle servira pour la VM et pour le DNS.

---

## Étape 3 — Créer la VM (Ampere arm64)

1. ☰ → **Compute → Instances → Create instance**.
2. Nom : `fasofree-api`.
3. **Image :** `Change image` → **Canonical Ubuntu 24.04** (aarch64). Évite « Minimal » pour simplifier.
4. **Shape :** `Change shape` → **Virtual Machine → Ampere → VM.Standard.A1.Flex** :
   - OCPU : `2`
   - Memory : `4 GB` (minimum conseillé ; tu es couvert par les 4 OCPU / 24 Go Always Free).
5. **Networking :** choisir `fasofree-vcn` / `Public Subnet`, et **Assign public IPv4 address** → `Reserved public IP` → sélectionner l'IP de l'étape 2.
6. **Boot volume :** 50 Go (toujours couvert par le quota gratuit).
7. **SSH keys :** télécharge une paire de clés générée par Oracle (**Save Private Key** → fichier `.key`) **ou** colle ta clé publique. → Rends-toi à l'étape 4 avec cette clé.
8. **Create.**

---

## Étape 4 — Connexion SSH (depuis Windows PowerShell)

```powershell
# Adapter le chemin vers ta clé privée téléchargée
ssh -i C:\chemin\vers\ma_cle.key ubuntu@IP_DU_VPS
```

> Windows peut se plaindre des permissions de clé : clic droit sur le fichier → Propriétés → Sécurité → Avancé → désactiver l'héritage → « Remove all », puis t'accorder Lecture/Écriture. Ou utilise une clé protégée par passphrase générée via `ssh-keygen`.

---

## Étape 5 — Firewall système (ufw/iptables)

Sur les images Ubuntu Oracle, en plus de la Security List, il faut ouvrir les ports **au niveau du système** :

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3100/tcp   # test direct (optionnel)
sudo ufw --force enable
sudo ufw status verbose    # vérifier : Active + ports ouverts
```

---

## Étape 6 — Node.js 20 + PM2

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
node -v ; npm -v          # v20.x

# PM2 (dans l'environnement nvm courant)
npm install -g pm2

# Outils de build (fallback si une dépendance native soulève le build ARM)
sudo apt install -y build-essential python3 make g++
```

---

## Étape 7 — Upload + build du backend

Depuis ton PC, dans le repo (fichiers buildés sinon sur ARM *peuvent* différer) :

```powershell
scp -r .\fasofree-backend ubuntu@IP_DU_VPS:/opt/
scp .\deploy\ecosystem.config.js ubuntu@IP_DU_VPS:/opt/fasofree-backend/
scp .\deploy\.env.production.example ubuntu@IP_DU_VPS:/opt/fasofree-backend/.env
```

Sur le serveur :

```bash
cd /opt/fasofree-backend
chmod -R u+w .
npm ci
npm run build     # nest build → dist/
ls dist/main.js   # doit exister
```

Puis **remplis le `.env`** (valeurs de ton ancien dashboard Render) :

```bash
nano .env
```

Points à adapter dans `.env` :
- `PORT=3100`
- `CORS_ORIGIN="https://fasofree-admin.onrender.com,https://fasofree-client.onrender.com,https://admin.fasofree.site"`
- `APP_WEBHOOK_URL=https://api.fasofree.site/api/v1`
- tout le reste (DB URL, JWT_SECRET, FIREBASE, REDIS, SMTP…) = identique à Render.

---

## Étape 8 — Démarrer PM2

```bash
cd /opt/fasofree-backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup                        # colle la commande sudo affichée
pm2 status                         # fasofree-api = online
pm2 logs fasofree-api --lines 50   # si erreur au boot, voir les logs
```

Pendant un test direct (avant Caddy) : `http://IP_DU_VPS:3100/api/v1/health/ready` doit répondre.

---

## Étape 9 — Caddy (HTTPS auto + WebSocket)

```bash
# Installer Caddy depuis le dépôt officiel
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# Poster la config (celle du fichier deploy/Caddyfile)
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
```

> ⚠️ La résolution DNS doit **déjà pointer** vers ton IP AVANT de recharger Caddy (sinon le certificat Let's Encrypt ne peut pas être généré). → étape 10 d'abord, puis :

```bash
sudo systemctl reload caddy
sudo caddy validate --config /etc/caddy/Caddyfile   # check config si besoin
```

---

## Étape 10 — DNS

Chez ton registrar (Hostinger DNS, Cloudflare, ou gestionnaire OCI) :
- **Type : A — Nom : `api` — Valeur : `IP_DU_VPS`** (créé sur ton domaine `fasofree.site`).

Vérifier :
```bash
dig +short api.fasofree.site
```

---

## Étape 11 — Mettre à jour les frontends (Render)

Dans Render, pour les 2 services frontend :
- `fasofree-admin` → variable **`VITE_API_URL`** → `https://api.fasofree.site/api/v1`
- `fasofree-client` → variable **`VITE_API_BASE_URL`** → `https://api.fasofree.site/api/v1`

Puis redéployer. (Les origines `*.onrender.com` sont déjà acceptées par le CORS du backend — pas besoin de toucher `CORS_ORIGIN` pour ça.)

---

## Étape 12 — Monitoring (compenser l'absence de support)

1. **UptimeRobot** (gratuit) : créé un monitor **HTTP(S)** sur `https://api.fasofree.site/api/v1/health/ready`, intervalle 1 min, alerte par email/WhatsApp.
2. Optionnel : **Sentry** (déjà dans le code via `SENTRY_DSN`) et `prometheus`/`netdata` pour la RAM.
3. Alerte de budget Oracle (étape 0) : surveille-toi toi-même.

---

## Checklist de vérification

- [ ] `https://api.fasofree.site/api/v1/health/ready` → `200 ok`
- [ ] `https://api.fasofree.site/api/docs` → Swagger chargé
- [ ] `pm2 status` → `online`, redémarre après `sudo reboot`
- [ ] Caddy sert du HTTPS valide (certificat Let's Encrypt)
- [ ] WebSocket socket.io fonctionne (testé côté app client)
- [ ] CRUD produit / login réel OK (test de bout en bout avec la DB)
- [ ] UptimeRobot vert + alerte de budget Oracle active

## Débogage rapide

```bash
pm2 logs fasofree-api --lines 100   # erreurs applicatives
tail -f /var/log/caddy/access.log   # trafic / codes HTTP
ss -tlnp | grep -E '3100|80|443'    # ports écoute
sudo ufw status verbose             # firewall système
```