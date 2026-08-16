import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Car,
  LocateFixed,
  MapPin,
  Navigation,
  Check,
  AlertCircle,
} from 'lucide-react';
import Footer from '../components/Footer';
import { api } from '../services/api';
import useAuthStore from '../store/authStore';

const OUAGA_CENTER = { latitude: 12.3714, longitude: -1.5197 };

const emptyLocation = (user = {}) => ({
  address: '',
  latitude: OUAGA_CENTER.latitude,
  longitude: OUAGA_CENTER.longitude,
  contactName: [user.firstName, user.lastName].filter(Boolean).join(' '),
  contactPhone: user.phone || '',
});

const RideBooking = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [pickup, setPickup] = useState(() => emptyLocation(user));
  const [dropoff, setDropoff] = useState(() => emptyLocation(user));
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const updateLocation = (setter, field, value) =>
    setter((prev) => ({ ...prev, [field]: value }));

  const handleUseCurrentLocation = (setter) => {
    if (!navigator.geolocation) {
      alert('Géolocalisation non disponible sur cet appareil');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setter((prev) => ({
          ...prev,
          address: 'Position actuelle (GPS)',
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        }));
      },
      () => alert('Impossible de récupérer votre position'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const isLocationValid = (loc) =>
    loc.address.trim() && loc.contactName.trim() && loc.contactPhone.trim();

  const handleEstimate = async (e) => {
    e.preventDefault();
    setError('');
    setQuote(null);
    if (!isLocationValid(pickup) || !isLocationValid(dropoff)) {
      setError('Veuillez remplir les adresses et les contacts.');
      return;
    }
    setQuoting(true);
    try {
      const result = await api.quoteOrder({
        orderType: 'RIDE',
        pickupLocation: {
          address: pickup.address,
          latitude: Number(pickup.latitude),
          longitude: Number(pickup.longitude),
          contactName: pickup.contactName,
          contactPhone: pickup.contactPhone,
        },
        dropoffLocation: {
          address: dropoff.address,
          latitude: Number(dropoff.latitude),
          longitude: Number(dropoff.longitude),
          contactName: dropoff.contactName,
          contactPhone: dropoff.contactPhone,
        },
      });
      setQuote(result);
    } catch (err) {
      setError(
        err?.message ||
          "Impossible d'estimer le tarif. Vérifiez que vous êtes connecté et réessayez.",
      );
    } finally {
      setQuoting(false);
    }
  };

  const handleConfirm = async () => {
    setError('');
    setSubmitting(true);
    try {
      const totalAmount = quote?.total || 0;
      const response = await api.createOrder({
        orderType: 'RIDE',
        totalAmount,
        pickupLocation: {
          address: pickup.address,
          latitude: Number(pickup.latitude),
          longitude: Number(pickup.longitude),
          contactName: pickup.contactName,
          contactPhone: pickup.contactPhone,
        },
        dropoffLocation: {
          address: dropoff.address,
          latitude: Number(dropoff.latitude),
          longitude: Number(dropoff.longitude),
          contactName: dropoff.contactName,
          contactPhone: dropoff.contactPhone,
        },
      });
      setSuccess({
        id: response?.id,
        pinCode: response?.deliveryPinCode,
        totalAmount: response?.totalAmount ?? totalAmount,
      });
    } catch (err) {
      setError(
        err?.message ||
          'Impossible de confirmer votre course. Vérifiez votre solde et réessayez.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Écran de confirmation ───────────────────────────────────────────
  if (success) {
    return (
      <div className="app-page text-text-primary font-sans">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="app-panel rounded-lg p-8 text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-status-success/15">
              <Check size={28} className="text-status-success" />
            </div>
            <h1 className="text-2xl font-display font-semibold tracking-[-0.03em] text-text-primary">
              Course confirmée !
            </h1>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Votre chauffeur a été notifié. Présentez ce code PIN au chauffeur
              pour valider votre course.
            </p>
            <p className="mt-4 font-mono text-sm text-text-primary">
              Référence : {success.id}
            </p>

            <div className="mt-6 mx-auto max-w-xs rounded-lg border-2 border-dashed border-accent-primary bg-accent-primary/5 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-primary mb-2">
                Code PIN de validation
              </p>
              <p className="text-4xl font-mono font-bold tracking-[0.3em] text-text-primary">
                {success.pinCode || '----'}
              </p>
            </div>

            <p className="mt-4 text-sm text-text-secondary">
              Montant séquestré :{' '}
              <span className="font-mono font-bold text-text-primary">
                {Number(success.totalAmount).toLocaleString('fr-FR')} FCFA
              </span>
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                className="app-action w-full sm:w-auto gap-2"
                onClick={() =>
                  navigate('/order-tracking', { state: { orderId: success.id } })
                }
              >
                <Navigation size={16} /> Suivre ma course en direct
              </button>
              <button
                type="button"
                className="app-action-secondary w-full sm:w-auto"
                onClick={() => navigate('/')}
              >
                Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ─── Formulaire ──────────────────────────────────────────────────────
  const renderLocation = (title, icon, loc, setter) => (
    <div className="app-panel rounded-lg p-5 mb-6 fade-in">
      <h2 className="text-sm font-medium text-text-secondary mb-6 flex items-center gap-2">
        {icon}
        {title}
      </h2>

      <button
        type="button"
        className="app-action-secondary w-full mb-4 gap-2"
        onClick={() => handleUseCurrentLocation(setter)}
      >
        <LocateFixed size={16} /> Utiliser ma position actuelle
      </button>

      <div className="mb-4">
        <label className="block text-xs text-text-secondary mb-2">
          Adresse complète *
        </label>
        <input
          type="text"
          placeholder="Quartier, rue, point de repère..."
          value={loc.address}
          onChange={(e) => updateLocation(setter, 'address', e.target.value)}
          required
          className="app-input"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs text-text-secondary mb-2">
            Contact *
          </label>
          <input
            type="text"
            placeholder="Nom du passager"
            value={loc.contactName}
            onChange={(e) => updateLocation(setter, 'contactName', e.target.value)}
            required
            className="app-input"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-2">
            Téléphone *
          </label>
          <input
            type="tel"
            placeholder="+226 XX XX XX XX"
            value={loc.contactPhone}
            onChange={(e) => updateLocation(setter, 'contactPhone', e.target.value)}
            required
            className="app-input"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-text-secondary mb-2">Latitude</label>
          <input
            type="number"
            step="any"
            value={loc.latitude}
            onChange={(e) => updateLocation(setter, 'latitude', e.target.value)}
            className="app-input"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-2">Longitude</label>
          <input
            type="number"
            step="any"
            value={loc.longitude}
            onChange={(e) => updateLocation(setter, 'longitude', e.target.value)}
            className="app-input"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-page text-text-primary font-sans">
      <header className="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-background-secondary transition-colors"
              aria-label="Retour"
            >
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <div>
              <h1 className="text-lg font-display font-bold text-text-primary">
                FasoFree Ride
              </h1>
              <p className="text-xs text-text-secondary">
                VTC / moto-taxi à la demande · 200 FCFA/km
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleEstimate}>
          {renderLocation(
            'Point de départ',
            <MapPin size={16} className="text-accent-primary" strokeWidth={1.5} />,
            pickup,
            setPickup,
          )}

          {renderLocation(
            'Destination',
            <Navigation size={16} className="text-accent-primary" strokeWidth={1.5} />,
            dropoff,
            setDropoff,
          )}

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-md border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {quote && (
            <div className="app-panel rounded-lg p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  Estimation du tarif
                </h3>
                <Car size={18} className="text-accent-primary" strokeWidth={1.5} />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-text-secondary">
                  <span>Trajet (conducteur)</span>
                  <span className="font-mono">
                    {Number(quote.deliveryFee).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Frais de service</span>
                  <span className="font-mono">
                    {Number(quote.platformFee).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="flex justify-between border-t border-border-light pt-2 font-bold text-text-primary">
                  <span>Total</span>
                  <span className="font-mono">
                    {Number(quote.total).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              className="app-action-secondary"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={16} /> Retour
            </button>

            {!quote ? (
              <button type="submit" className="app-action gap-2" disabled={quoting}>
                {quoting ? 'Estimation...' : 'Estimer le tarif'}
              </button>
            ) : (
              <button
                type="button"
                className="app-action gap-2"
                disabled={submitting}
                onClick={handleConfirm}
              >
                <Car size={16} />
                {submitting ? 'Confirmation...' : 'Confirmer la course'}
              </button>
            )}
          </div>
        </form>

        <p className="mt-8 flex items-start gap-2 text-xs leading-5 text-text-tertiary">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          Le montant est séquestré sur votre portefeuille FasoFree. Il est versé au
          chauffeur à la livraison, après validation du code PIN.
        </p>
      </div>

      <Footer />
    </div>
  );
};

export default RideBooking;
