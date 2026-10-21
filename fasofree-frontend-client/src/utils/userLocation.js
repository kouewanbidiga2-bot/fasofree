/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

// 📍 Position de l'utilisateur : promise mémoïsée, résolue UNE fois par session.
// Les re-fetchs TanStack Query (retour arrière, changement de catégorie, focus
// d'onglet) réutilisent la même position au lieu de re-solliciter le GPS à chaque
// requête. Fallback Ouagadougou si la permission est refusée ou indisponible —
// c'était déjà le comportement historique de Home/Search.
let locationPromise = null;

export function getUserLocation() {
  if (locationPromise) return locationPromise;
  locationPromise = new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 12.37, lng: -1.52 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: 12.37, lng: -1.52 }), // Fallback Ouaga
      { timeout: 5000, maximumAge: 300000 },
    );
  });
  return locationPromise;
}
