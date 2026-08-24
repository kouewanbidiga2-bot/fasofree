/**
 * Estimation client-side du prix P2P (Haversine + tarif FasoFree).
 * Même formule que le backend distance-calculator.service.ts :
 * prix = 1000 (base : essence A/R + bénéfice livreur) + distance_km × 200
 *        + fragile 100 + poids > 5kg × 50/kg   (arrondi au 50 supérieur)
 */
const P2P_MIN_PRICE = 1000;
const P2P_PRICE_PER_KM = 200;
const P2P_FRAGILE_SURCHARGE = 100;
const P2P_WEIGHT_SURCHARGE_PER_KG = 50;
const P2P_WEIGHT_THRESHOLD = 5;

function toRad(deg) {
  return deg * (Math.PI / 180);
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * @returns {{ distance: number, price: number, breakdown: object }}
 */
export function estimateP2PPrice(pickup, dropoff, isFragile = false, weight = 0) {
  const lat1 = Number(pickup.latitude);
  const lon1 = Number(pickup.longitude);
  const lat2 = Number(dropoff.latitude);
  const lon2 = Number(dropoff.longitude);

  if ([lat1, lon1, lat2, lon2].some((v) => isNaN(v))) {
    return null;
  }

  const distance = Math.round(haversineDistance(lat1, lon1, lat2, lon2) * 100) / 100;

  const basePrice = P2P_MIN_PRICE;
  const distancePrice = Math.round(distance * P2P_PRICE_PER_KM);
  const fragilePrice = isFragile ? P2P_FRAGILE_SURCHARGE : 0;
  const weightNum = Number(weight) || 0;
  const weightPrice = weightNum > P2P_WEIGHT_THRESHOLD
    ? Math.round((weightNum - P2P_WEIGHT_THRESHOLD) * P2P_WEIGHT_SURCHARGE_PER_KG)
    : 0;

  const rawPrice = basePrice + distancePrice + fragilePrice + weightPrice;
  // Arrondi au multiple de 50 FCFA supérieur (identique au backend)
  const price = Math.ceil(rawPrice / 50) * 50;

  return {
    distance,
    price,
    breakdown: { basePrice, distancePrice, fragileSurcharge: fragilePrice, weightSurcharge: weightPrice },
  };
}
