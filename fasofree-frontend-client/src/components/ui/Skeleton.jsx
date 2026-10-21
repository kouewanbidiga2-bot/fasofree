/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import React from 'react';

/**
 * Bloc « squelette » (Phase 2 fluidité — micro-interactions).
 *
 * Simple bloc `animate-pulse` (utilitaire Tailwind natif) habillé avec les
 * tokens FasoFree (`bg-background-secondary`) : AUCUNE nouvelle couleur,
 * aucune typo, aucune structure — on reproduit les dimensions exactes de
 * l'élément réel pour éviter tout saut de mise en page au chargement.
 * `prefers-reduced-motion` est déjà neutralisé par la règle globale index.css.
 *
 * Usage : <Skeleton className="h-4 w-3/4 rounded" /> (className complète les
 * dimensions/formes, `rounded` 8px par défaut).
 */
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-background-secondary rounded ${className}`} />
);

export default Skeleton;
