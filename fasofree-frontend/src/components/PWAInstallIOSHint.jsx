/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { useEffect, useState } from 'react';
import { Share2, PlusSquare, X } from 'lucide-react';

export default function PWAInstallIOSHint() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone;
    if (isStandalone) {
      setShow(false);
      return;
    }

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (!isIOS) {
      setShow(false);
      return;
    }

    const wasDismissed = localStorage.getItem('pwa-ios-hint-dismissed') === '1';
    if (wasDismissed) {
      setShow(false);
      setDismissed(true);
      return;
    }

    setShow(true);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('pwa-ios-hint-dismissed', '1');
    setShow(false);
    setDismissed(true);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1rem)] max-w-md px-4">
      <div className="relative bg-background-primary border border-border-light rounded-2xl shadow-lg p-4 text-text-primary">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-background-secondary"
          aria-label="Fermer"
          type="button"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-sm font-bold mb-2 pr-6">
          Installer FasoFree sur votre iPhone
        </h3>

        <ol className="space-y-2 text-xs text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              1
            </span>
            <span>
              Ouvrez cette page dans <strong>Safari</strong>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              2
            </span>
            <span className="flex items-center gap-1.5 flex-wrap">
              Appuyez sur <Share2 className="w-3.5 h-3.5 inline" />{' '}
              <strong>Partager</strong>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              3
            </span>
            <span className="flex items-center gap-1.5 flex-wrap">
              Sélectionnez{' '}
              <strong>Ajouter à l&apos;écran d&apos;accueil</strong>{' '}
              <PlusSquare className="w-3.5 h-3.5 inline" />
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              4
            </span>
            <span>Appuyez sur <strong>Ajouter</strong></span>
          </li>
        </ol>
      </div>
    </div>
  );
}
