/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
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
 * le montage du composant sur les routes hors `Layout` — était perdu et le
 * bouton n'apparaissait jamais.
 */
export default function PWAInstallButton() {
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
      className="client-tool"
      aria-label="Installer l'application"
      type="button"
    >
      <Download size={17} aria-hidden="true" />
      <span className="client-tool-label">Installer l’app</span>
    </button>
  );
}
