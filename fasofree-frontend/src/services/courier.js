/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

/**
 * Koliwa Coursier — appels API du livreur.
 *
 * Transitions autorisées côté backend (FSM) :
 *   READY_FOR_PICKUP → DRIVER_ASSIGNED   via POST /dispatch/accept/:id
 *   DRIVER_ASSIGNED  → IN_DELIVERY       via PATCH /orders/:id/status
 *   IN_DELIVERY      → DELIVERED_PENDING_CONFIRMATION  via POST /orders/:id/driver-validate
 *   DELIVERED_PENDING_CONFIRMATION → COMPLETED  par le code PIN du client
 * Le livreur ne confirme donc jamais lui-même la réception finale.
 */
import api from './api';

/** Statuts où la course est encore entre les mains du livreur. */
export const ON_ROUTE_STATUSES = ['DRIVER_ASSIGNED', 'PROCESSING', 'IN_DELIVERY'];
export const ACTIVE_STATUSES = [...ON_ROUTE_STATUSES, 'DELIVERED_PENDING_CONFIRMATION'];

export const fetchAvailableCourses = async () => {
  const { data } = await api.get('/dispatch/available');
  return Array.isArray(data) ? data : (data?.orders ?? []);
};

export const fetchTodayEarnings = async () => {
  const { data } = await api.get('/dispatch/my-earnings-today');
  return data;
};

export const contactMissionSupport = async (orderId, reason, details) => {
  const { data } = await api.post(`/dispatch/support/${orderId}`, { reason, details });
  return data;
};

export const fetchMyOrders = async () => {
  const { data } = await api.get('/orders/my-orders', {
    params: { limit: 30, status: ACTIVE_STATUSES.join(',') },
  });
  const rows = Array.isArray(data) ? data : (data?.orders ?? data?.items ?? []);
  return rows;
};

export const fetchOrder = async (orderId) => {
  const { data } = await api.get(`/orders/${orderId}`);
  return data?.order ?? data;
};

export const fetchOrderTracking = async (orderId) => {
  const { data } = await api.get(`/orders/${orderId}/tracking`);
  return data;
};

export const recordArrival = async (orderId, stop) => {
  const { data } = await api.post(`/orders/${orderId}/courier-arrival`, { stop });
  return data;
};

export const fetchCourierRoute = async (orderId, { latitude, longitude }, signal) => {
  const { data } = await api.get(`/orders/${orderId}/courier-route`, { params: { latitude, longitude }, signal });
  return data;
};

export const reportCourierLocation = async (orderId, { latitude, longitude }) => {
  const { data } = await api.post(`/orders/${orderId}/driver-location`, { latitude, longitude });
  return data?.success === true;
};

export const acceptCourse = async (orderId) => {
  const { data } = await api.post(`/dispatch/accept/${orderId}`);
  return data;
};

export const refuseCourse = async (orderId) => {
  const { data } = await api.post(`/dispatch/refuse/${orderId}`);
  return data;
};

export const markPickedUp = async (orderId) => {
  const { data } = await api.patch(`/orders/${orderId}/status`, { status: 'IN_DELIVERY' });
  return data;
};

/** Le livreur signale qu'il a remis le colis : le client confirme ensuite avec son code. */
export const markDelivered = async (orderId, note) => {
  const { data } = await api.post(`/orders/${orderId}/driver-validate`, note ? { note } : {});
  return data;
};

/** Disponibilité du livreur (en ligne + accepte les courses + position). */
export const setDriverStatus = async (payload) => {
  const { data } = await api.patch('/users/me/driver-status', payload);
  return data;
};

/**
 * Découpe le gain d'une course : montant livraison, commission plateforme
 * prélevée au livreur (125 FCFA, plafonnée côté serveur) et net à percevoir.
 */
export const earningOf = (order) => {
  const gross = Number(order?.deliveryFee ?? 0);
  const fee = Number(order?.driverCommissionAmount ?? 0);
  return { gross, fee, net: Math.max(0, gross - fee) };
};

export const STATUS_LABELS = {
  PENDING: 'En attente',
  AWAITING_PAYMENT: 'Paiement en attente',
  PAID: 'Payée',
  IN_PREPARATION: 'En préparation',
  READY_FOR_PICKUP: 'Disponible',
  DRIVER_ASSIGNED: 'À récupérer',
  PROCESSING: 'En cours',
  IN_DELIVERY: 'En livraison',
  DELIVERED_PENDING_CONFIRMATION: 'Colis remis · code attendu',
  DELIVERED: 'Livrée',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  FAILED: 'Échouée',
  DISPUTED: 'Litige',
  REFUNDED: 'Remboursée',
};

export const statusLabel = (status) => STATUS_LABELS[status] || status || '—';
