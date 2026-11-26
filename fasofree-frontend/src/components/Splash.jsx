/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/**
 * Écran d'ouverture.
 *
 * Trois temps : le wordmark se pose, le coursier en moto traverse l'écran, puis
 * la moto s'efface et le colis qui court prend sa place — c'est la signature de
 * Koliwa. Le tout en CSS : aucune librairie d'animation, donc rien de plus à
 * télécharger sur un téléphone en 3G.
 *
 * `onDone` est toujours appelé, même si l'utilisateur a demandé moins
 * d'animations : le chargement ne doit jamais rester bloqué.
 */
import { useEffect, useState } from 'react';
import { KoliwaWordmark } from './brand';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const Splash = ({ onDone }) => {
  const [phase, setPhase] = useState(() => (prefersReducedMotion() ? 'logo' : 'ride'));

  useEffect(() => {
    if (phase === 'logo') {
      const finish = setTimeout(() => onDone?.(), 520);
      return () => clearTimeout(finish);
    }

    const toMorph = setTimeout(() => setPhase('morph'), 1150);
    const toLogo = setTimeout(() => setPhase('logo'), 1620);
    return () => {
      clearTimeout(toMorph);
      clearTimeout(toLogo);
    };
  }, [phase, onDone]);

  return (
    <div className={`splash splash-${phase}`} role="status" aria-live="polite">
      <div className="splash-stage">
        <KoliwaWordmark height={40} className="splash-word" />

        <div className="splash-scene">
          <span className="splash-lines" aria-hidden="true" />
          <img className="splash-moto" src="/koliwa-courier-splash.svg" alt="" aria-hidden="true" />
          <img className="splash-parcel" src="/assets/koliwa-mark-run.png" alt="Koliwa" />
        </div>

        <p className="splash-status">Chargement…</p>
      </div>
    </div>
  );
};

export default Splash;
