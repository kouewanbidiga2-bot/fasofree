/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { useSyncExternalStore } from 'react';
import { Download } from 'lucide-react';
import {
  getInstallState,
  subscribeInstall,
  promptInstall,
} from '../services/pwaInstall';

/**
 * Bouton « Installer l'app ».
 *
 * ⚠️ Il ne branche AUCUN écouteur `beforeinstallprompt` lui-même : l'événement
 * est capturé une fois pour toutes par `services/pwaInstall.js` (importé au
 * démarrage). Sans cela, l'événement — émis une seule fois par chargement, avant
 * le montage du bouton (souvent sur /login) — était perdu et le bouton
 * n'apparaissait jamais.
 */
export default function PWAInstallButton({ className = '' }) {
  const { canInstall, installed } = useSyncExternalStore(
    subscribeInstall,
    getInstallState,
    getInstallState,
  );

  if (installed || !canInstall) return null;

  const handleInstall = () => {
    promptInstall().catch(() => {});
  };

  return (
    <button
      onClick={handleInstall}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition ${className}`}
      aria-label="Installer l'application"
      type="button"
    >
      <Download className="w-4 h-4" />
      <span>Installer l&apos;app</span>
    </button>
  );
}
