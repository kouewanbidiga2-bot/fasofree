import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import MissionMap from '../components/MissionMap';
import Shell from '../components/Shell';
import { ErrorNote, Loading } from '../components/ui';
import { fetchMyOrders, ON_ROUTE_STATUSES } from '../services/courier';

export default function CourierMap() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let current = true;
    const refresh = async () => {
      try {
        const rows = await fetchMyOrders();
        if (!current) return;
        setOrders(rows.filter((order) => ON_ROUTE_STATUSES.includes(order.status)));
        setError(null);
      } catch (failure) {
        if (current) setError(failure.message);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 20_000);
    return () => { current = false; window.clearInterval(timer); };
  }, []);

  return (
    <Shell title="Carte">
      <MissionMap />
      {error && <ErrorNote>{error}</ErrorNote>}
      {!orders && !error && <Loading label="Recherche de vos courses…" />}
      {orders?.length === 0 && <p className="muted">Vos courses s’afficheront ici dès leur attribution.</p>}
      {orders?.map((order) => {
        const dropoff = order.status === 'IN_DELIVERY';
        const stop = dropoff ? order.dropoffLocation ?? order.deliveryLocation : order.pickupLocation;
        return (
          <Link className="card map-course-link" to={`/missions/${order.id}`} key={order.id}>
            <span>
              <strong>{stop?.address || (dropoff ? 'Adresse de remise' : 'Point de retrait')}</strong>
              <span className="muted">{dropoff ? 'Remise' : 'Retrait'}{order.trackingReference ? ` · ${order.trackingReference}` : ''}</span>
            </span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        );
      })}
    </Shell>
  );
}
