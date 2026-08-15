import { MapPin, Package } from 'lucide-react';

// Coordonnées par défaut : centre de Ouagadougou
export const OUAGA_CENTER = { latitude: 12.3714, longitude: -1.5197 };

export const STEPS = [
  { id: 1, label: 'Ramassage', icon: MapPin },
  { id: 2, label: 'Livraison', icon: MapPin },
  { id: 3, label: 'Colis & contact', icon: Package },
];

export const emptyLocation = {
  address: '',
  latitude: OUAGA_CENTER.latitude,
  longitude: OUAGA_CENTER.longitude,
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
