/**
 * Règles opérationnelles communes au dispatch interne et à l'app livreur.
 * Ces valeurs sont volontairement centralisées pour éviter que le backend,
 * le dashboard et les notifications appliquent des limites différentes.
 */

import { Order, OrderStatus } from '../orders/entities/order.entity';

export const MAX_ACTIVE_DELIVERIES_PER_DRIVER = 3;
export const DISPATCH_ZONE_RADIUS_KM = 2;

export const ACTIVE_DELIVERY_STATUSES = [
  OrderStatus.DRIVER_ASSIGNED,
  OrderStatus.PROCESSING,
  OrderStatus.IN_DELIVERY,
  OrderStatus.DELIVERED_PENDING_CONFIRMATION,
] as const;

type GeoPoint = { latitude?: number; longitude?: number } | null | undefined;

function distanceKm(a: GeoPoint, b: GeoPoint): number | null {
  if (
    a?.latitude == null ||
    a.longitude == null ||
    b?.latitude == null ||
    b.longitude == null
  ) {
    return null;
  }
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

/**
 * Les missions cumulées doivent rester dans le même bassin opérationnel.
 * On compare le point de récupération et, lorsqu'ils sont connus, le point
 * de livraison. Une donnée GPS manquante ne bloque pas l'opérateur.
 */
export function isCompatibleDeliveryZone(
  candidate: Pick<Order, 'pickupLocation' | 'dropoffLocation'>,
  activeOrders: Array<Pick<Order, 'pickupLocation' | 'dropoffLocation'>>,
): boolean {
  return activeOrders.every((active) => {
    const pickupDistance = distanceKm(candidate.pickupLocation, active.pickupLocation);
    const dropoffDistance = distanceKm(candidate.dropoffLocation, active.dropoffLocation);
    return (
      (pickupDistance == null || pickupDistance <= DISPATCH_ZONE_RADIUS_KM) &&
      (dropoffDistance == null || dropoffDistance <= DISPATCH_ZONE_RADIUS_KM)
    );
  });
}

