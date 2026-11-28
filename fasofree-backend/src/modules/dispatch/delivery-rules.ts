/**
 * Règles opérationnelles communes au dispatch interne et à l'app livreur.
 * Ces valeurs sont volontairement centralisées pour éviter que le backend,
 * le dashboard et les notifications appliquent des limites différentes.
 */

import { FulfillmentType, Order, OrderStatus, OrderType } from '../orders/entities/order.entity';

export const MAX_ACTIVE_DELIVERIES_PER_DRIVER = 3;
export const DISPATCH_ZONE_RADIUS_KM = 2;
export const P2P_WAVE_RADII_KM = [1, 2.5, 5, 8, 10] as const;
export const P2P_OFFER_DURATION_MS = 25_000;
export const P2P_GPS_MAX_AGE_MS = 60_000;

export const ACTIVE_DELIVERY_STATUSES = [
  OrderStatus.DRIVER_ASSIGNED,
  OrderStatus.PROCESSING,
  OrderStatus.IN_DELIVERY,
  OrderStatus.DELIVERED_PENDING_CONFIRMATION,
] as const;

type GeoPoint = { latitude?: number; longitude?: number } | null | undefined;

export function deliveryDistanceKm(a: GeoPoint, b: GeoPoint): number | null {
  if (
    a?.latitude == null ||
    a.longitude == null ||
    b?.latitude == null ||
    b.longitude == null ||
    ![a.latitude, a.longitude, b.latitude, b.longitude].every(Number.isFinite) ||
    Math.abs(a.latitude) > 90 || Math.abs(b.latitude) > 90 ||
    Math.abs(a.longitude) > 180 || Math.abs(b.longitude) > 180
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
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function isOpenP2pOrder(order: Order): boolean {
  return order.orderType === OrderType.P2P_DELIVERY &&
    order.fulfillmentType === FulfillmentType.DELIVERY &&
    [OrderStatus.PAID, OrderStatus.READY_FOR_PICKUP].includes(order.status) &&
    !order.driverId && !order.deliveryProviderId && Boolean(order.paymentTransactionRef);
}

export function activeP2pOffer(order: Order, driverId: string, now = Date.now()) {
  return order.dispatchCandidates?.find(candidate => candidate.driverId === driverId
    && !candidate.refused && Date.parse(candidate.offerExpiresAt ?? '') > now);
}

/**
 * Les missions cumulées doivent rester dans le même bassin opérationnel.
 * On compare le point de récupération et, lorsqu'ils sont connus, le point
 * de livraison. Pour un colis, les deux paires de points doivent être connus.
 */
export function isCompatibleDeliveryZone(
  candidate: Pick<Order, 'pickupLocation' | 'dropoffLocation'> & Partial<Pick<Order, 'orderType' | 'deliveryLocation'>>,
  activeOrders: Array<Pick<Order, 'pickupLocation' | 'dropoffLocation'> & Partial<Pick<Order, 'deliveryLocation'>>>,
): boolean {
  return activeOrders.every((active) => {
    const pickupDistance = deliveryDistanceKm(candidate.pickupLocation, active.pickupLocation);
    const dropoffDistance = deliveryDistanceKm(candidate.dropoffLocation ?? candidate.deliveryLocation,
      active.dropoffLocation ?? active.deliveryLocation);
    if (candidate.orderType === OrderType.P2P_DELIVERY && (pickupDistance == null || dropoffDistance == null)) return false;
    return (
      (pickupDistance == null || pickupDistance <= DISPATCH_ZONE_RADIUS_KM) &&
      (dropoffDistance == null || dropoffDistance <= DISPATCH_ZONE_RADIUS_KM)
    );
  });
}

