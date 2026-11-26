/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

// Coordonnées par défaut : centre de Ouagadougou
export const OUAGA_CENTER = { latitude: 12.3714, longitude: -1.5197 };

export const STEPS = [
  { id: 1, label: 'Départ' },
  { id: 2, label: 'Arrivée' },
  { id: 3, label: 'Colis et tarif' },
];

export const emptyLocation = {
  address: '',
  latitude: OUAGA_CENTER.latitude,
  longitude: OUAGA_CENTER.longitude,
  locationSource: 'approximate',
  contactName: '',
  contactPhone: '',
  instructions: '',
};

export const emptyPackage = {
  description: '',
  weight: '',
  isFragile: false,
  length: '',
  width: '',
  height: '',
  estimatedAmount: '',
};
