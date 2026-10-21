/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Cache de données du client FasoFree (TanStack Query v5).
 *
 * Phase « fluidité » — AUCUN changement visuel : mêmes écrans, même identité.
 * Ce qui change sous le capot :
 *   • retour arrière instantané : une page remontée affiche son cache immédiatement
 *     (plus d'écran blanc entre deux visites de la même session) ;
 *   • synchronisation discrète en arrière-plan quand les données ont dépassé
 *     `staleTime` (onglet re-focalisé, remontage de page) ;
 *   • mémoire du cache 5 min après démontage (gcTime).
 *
 * ⚠️ Les requêtes portant sur des données d'un compte (commandes, wallet, statut
 * VIP…) doivent inclure l'id utilisateur dans leur queryKey, et le cache global
 * est purgé au login/logout (store/authStore.js) — jamais de fuite entre comptes.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30 s : réaffichage instantané sans re-requête au retour arrière.
      staleTime: 30_000,
      // Le cache survit 5 min au démontage d'une page.
      gcTime: 5 * 60_000,
      // Resynchronisation de fond quand l'utilisateur revient dans l'onglet.
      refetchOnWindowFocus: true,
      // Une seule relance automatique : au-delà, on montre l'état d'erreur
      // (avec bouton « Réessayer ») plutôt que de multiplier les appels.
      retry: 1,
    },
  },
});

export default queryClient;
