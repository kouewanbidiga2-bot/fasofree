/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronRight, Plus } from 'lucide-react';
import DeliveryGlyph from '../components/DeliveryGlyph';
import Footer from '../components/Footer';
import TrackingModeNav from '../components/TrackingModeNav';
import Skeleton from '../components/ui/Skeleton';
import { api } from '../services/api';
import useAuthStore from '../store/authStore';
import { formatTrackingReference } from '../utils/trackingReference';

const STATUS_LABELS = {
  PENDING: 'En attente',
  AWAITING_PAYMENT: 'Paiement en attente',
  SCHEDULED: 'Programmée',
  PAID: 'Paiement confirmé',
  IN_PREPARATION: 'En attente de récupération',
  READY_FOR_PICKUP: 'À récupérer',
  DRIVER_ASSIGNED: 'Livreur assigné',
  IN_DELIVERY: 'En livraison',
  PROCESSING: 'En livraison',
  READY: 'Prête',
  DELIVERED_PENDING_CONFIRMATION: 'Arrivée, réception à confirmer',
  DELIVERED: 'Livrée',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  FAILED: 'Échouée',
  REFUNDED: 'Remboursée',
  DISPUTED: 'En cours de réclamation',
};

const FILTERS = ['PENDING', 'PAID', 'IN_PREPARATION', 'PROCESSING', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
const DELIVERY_DATE = new Intl.DateTimeFormat('fr-BF', { day: 'numeric', month: 'short', year: 'numeric' });
const DELIVERY_PRICE = new Intl.NumberFormat('fr-BF', { maximumFractionDigits: 0 });

export default function Orders() {
  const filterId = useId();
  const userId = useAuthStore((state) => state.user?.id);
  const [filter, setFilter] = useState('all');

  const { data: orders = [], isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['orders', 'my', userId || null, filter],
    queryFn: async () => {
      const response = await api.getMyOrders(filter === 'all' ? undefined : filter);
      return response.data || response;
    },
    staleTime: 15_000,
  });

  const loading = isLoading || (isError && isFetching);
  const filteredOrders = orders.filter((order) => filter === 'all' || order.status === filter);

  return (
    <div className="app-page orders-page">
      <div className="client-screen-frame">
        <header className="client-screen-heading">
          <div className="client-screen-title">
            <span><DeliveryGlyph kind="history" /></span>
            <h1>Mes livraisons</h1>
          </div>
          <Link to="/p2p-delivery" className="app-action"><Plus size={17} aria-hidden="true" /> Nouvel envoi</Link>
        </header>

        <div className="orders-toolbar">
          <TrackingModeNav />
          <div className="orders-filter">
            <label htmlFor={filterId}>Statut</label>
            <select id={filterId} value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">Toutes les livraisons</option>
              {FILTERS.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="orders-list" aria-label="Chargement des livraisons" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="orders-card">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-5 w-3/5 rounded" />
                <Skeleton className="h-3 w-40 rounded" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <section className="orders-empty">
            <p role="alert">Impossible de charger vos livraisons.</p>
            <button type="button" onClick={() => refetch()} className="app-action">Réessayer</button>
          </section>
        ) : filteredOrders.length === 0 ? (
          <section className="orders-empty">
            <DeliveryGlyph kind="parcel" />
            <h2>{filter === 'all' ? 'Vous n’avez pas encore de livraison' : 'Aucune livraison avec ce statut'}</h2>
            {filter === 'all' ? (
              <Link to="/p2p-delivery" className="orders-empty-link">Envoyer un colis <ArrowRight size={16} aria-hidden="true" /></Link>
            ) : (
              <button type="button" onClick={() => setFilter('all')} className="orders-empty-link">Voir toutes les livraisons <ArrowRight size={16} aria-hidden="true" /></button>
            )}
          </section>
        ) : (
          <ul className="orders-list">
            {filteredOrders.map((order) => {
              const createdAt = new Date(order.createdAt);
              const destination = order.dropoffLocation || order.deliveryLocation;
              const price = order.totalAmount ?? order.total;
              const finalStatus = ['DELIVERED', 'COMPLETED'].includes(order.status);
              const problemStatus = ['CANCELLED', 'FAILED', 'DISPUTED'].includes(order.status);
              return (
                <li key={order.id}>
                  <Link to="/order-tracking" state={{ orderId: order.id }} className="orders-card">
                    <div className="orders-card-top">
                      {!Number.isNaN(createdAt.getTime()) && <time dateTime={createdAt.toISOString()}>{DELIVERY_DATE.format(createdAt)}</time>}
                      <span className="orders-status" data-tone={finalStatus ? 'done' : problemStatus ? 'issue' : 'active'}>{STATUS_LABELS[order.status] || 'Livraison'}</span>
                    </div>
                    {(order.pickupLocation?.address || destination?.address) && (
                      <div className="orders-route">
                        <span>{order.pickupLocation?.address || 'Point de récupération'}</span>
                        <span>{destination?.address || 'Destination'}</span>
                      </div>
                    )}
                    <div className="orders-card-bottom">
                      <span className="orders-reference">{formatTrackingReference(order.trackingReference) || `Livraison #${order.id?.slice(0, 8)}`}</span>
                      {price != null && Number.isFinite(Number(price)) && <strong>{DELIVERY_PRICE.format(Number(price))} F CFA</strong>}
                      <ChevronRight size={17} aria-hidden="true" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Footer />
    </div>
  );
}
