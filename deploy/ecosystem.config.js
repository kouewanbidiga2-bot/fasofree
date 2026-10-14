// =============================================================================
// FasoFree Backend — Configuration PM2 (production)
// -----------------------------------------------------------------------------
// Déploie l'API NestJS avec PM2 sur un VPS (Oracle Cloud, Hostinger, etc.).
//
// Utilisation (sur le serveur, dans /opt/fasofree-backend) :
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup   # puis coller la commande affichée (démarrage au reboot)
//
// NB : les variables critiques (DATABASE_URL, JWT_SECRET, ...) sont lues
// depuis le fichier .env (chargé par @nestjs/config) situé dans cwd.
// =============================================================================

module.exports = {
  apps: [
    {
      name: 'fasofree-api',
      // Chemin absolu du projet sur le serveur — à ajuster si besoin.
      cwd: '/opt/fasofree-backend',
      script: 'dist/main.js',
      interpreter: 'node',
      exec_mode: 'fork', // 1 process : l'app possède déjà du state in-memory (socket.io, cache)
      instances: 1,

      // --- Résilience / auto-restart ---
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      max_memory_restart: '512M',
      kill_timeout: 5000, // graceful shutdown (enableShutdownHooks)
      shutdown_with_message: true,

      // --- Logs ---
      time: true,
      merge_logs: true,
      out_file: '/var/log/fasofree-api-out.log',
      error_file: '/var/log/fasofree-api-error.log',

      // --- Env par défaut (peut être écrasé par .env) ---
      env: {
        NODE_ENV: 'production',
        PORT: '3100',
      },
    },
  ],
};