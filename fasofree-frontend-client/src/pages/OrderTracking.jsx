import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle,
  Clock,
  Home,
  MessageCircle,
  Package,
  Truck,
  MapPin,
  Navigation,
  Send,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import api from '../services/api';
import { getChatSocket, getDispatchSocket } from '../services/realtime';
import useAuthStore from '../store/authStore';
import Footer from '../components/Footer';
import DisputeModal from '../components/DisputeModal';

const STATUS_STEP = {
  PENDING: 1,
  PAID: 1,
  IN_PREPARATION: 2,
  PREPARING: 2,
  READY_FOR_PICKUP: 2,
  DRIVER_ASSIGNED: 3,
  IN_DELIVERY: 3,
  PROCESSING: 3,
  READY: 3,
  DELIVERED_PENDING_CONFIRMATION: 4,
  DELIVERED: 4,
  COMPLETED: 4,
};

const STEP_LABELS_FOOD = [
  '',
  'Commande confirmée',
  'En préparation',
  'En route',
  'Livré',
];

const STEP_LABELS_RIDE = [
  '',
  'Course confirmée',
  'Chauffeur assigné',
  'En route',
  'Arrivé',
];

const STATUS_LABELS = {
  PENDING: 'En attente',
  PAID: 'Confirmée',
  IN_PREPARATION: 'En préparation',
  READY_FOR_PICKUP: 'Prête (retrait)',
  DRIVER_ASSIGNED: 'Livreur assigné',
  IN_DELIVERY: 'En livraison',
  PROCESSING: 'En route',
  DELIVERED_PENDING_CONFIRMATION: 'Arrivée - à confirmer',
  DELIVERED: 'Livrée',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  FAILED: 'Échouée',
  DISPUTED: 'Litige',
  REFUNDED: 'Remboursée',
};

const makeIcon = (color, label) =>
  L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const BUSINESS_ICON = makeIcon('#6B7280', 'R');
const PICKUP_ICON = makeIcon('#3B82F6', 'P');
const DELIVERY_ICON = makeIcon('#5C6B3C', 'D');
const DRIVER_ICON = makeIcon('#C1652E', 'L');

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [50, 50] });
    } else if (points.length === 1) {
      map.setView(points[0], 15);
    }
  }, [map, points]);
  return null;
}

const OUAGA = [12.3714, -1.5197];

const OrderTracking = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const myUserId = user?.id;

  const orderId =
    location.state?.orderId ||
    new URLSearchParams(location.search).get('id') ||
    new URLSearchParams(location.search).get('orderId');

  const [tracking, setTracking] = useState(null);
  const [error, setError] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [liveTrace, setLiveTrace] = useState([]);

  const [channel, setChannel] = useState('driver');
  const [messages, setMessages] = useState([]);
  const [chatActive, setChatActive] = useState(true);
  const [chatJoined, setChatJoined] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatBoxRef = useRef(null);
  const chatSocket = getChatSocket();
  const dispatchSocket = getDispatchSocket();

  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeError, setDisputeError] = useState(null);
  const [disputeSuccess, setDisputeSuccess] = useState(false);

  const status = tracking?.status || 'PENDING';
  const isRide = tracking?.orderType === 'RIDE';
  const STEP_LABELS = isRide ? STEP_LABELS_RIDE : STEP_LABELS_FOOD;
  const step = STATUS_STEP[status] || 1;
  const progress = (step / 4) * 100;
  const trackingActive = tracking?.trackingActive === true;

  // 1. Chargement initial du suivi (statut + trace + ETA)
  useEffect(() => {
    if (!orderId) {
      setError('Aucune commande à suivre.');
      return;
    }
    api
      .getOrderTracking(orderId)
      .then(setTracking)
      .catch((e) => setError(e.message || 'Erreur de chargement du suivi'));
  }, [orderId]);

  // 2. Initialisation de la position live depuis le serveur
  useEffect(() => {
    if (tracking?.driverLocation) {
      setDriverPos([
        tracking.driverLocation.latitude,
        tracking.driverLocation.longitude,
      ]);
    }
    if (tracking?.trace?.length) {
      setLiveTrace(tracking.trace.map((p) => [p.latitude, p.longitude]));
    }
  }, [tracking]);

  // 3. Écoute temps réel du GPS livreur (namespace /dispatch)
  useEffect(() => {
    if (!orderId) return;
    if (!dispatchSocket.connected) dispatchSocket.connect();

    dispatchSocket.emit('joinOrderTracking', { orderId });

    const onLocation = (data) => {
      if (!data || data.orderId !== orderId) return;
      const pos = [data.latitude, data.longitude];
      setDriverPos(pos);
      setLiveTrace((prev) => {
        const last = prev[prev.length - 1];
        if (last && last[0] === pos[0] && last[1] === pos[1]) return prev;
        return [...prev, pos].slice(-80);
      });
    };

    dispatchSocket.on('driverLocationUpdated', onLocation);

    return () => {
      dispatchSocket.off('driverLocationUpdated', onLocation);
    };
  }, [orderId, dispatchSocket]);

  // 4. Chat éphémère (namespace /chat) — canal merchant ou driver
  useEffect(() => {
    if (!orderId) return;
    if (!chatSocket.connected) chatSocket.connect();

    chatSocket.emit(
      'joinOrderChat',
      { orderId, channel },
      (res) => {
        if (res && res.status === 'ok') {
          setMessages(Array.isArray(res.history) ? res.history : []);
          setChatActive(res.active !== false);
          setChatJoined(true);
        } else if (res && res.status === 'closed') {
          setChatActive(false);
          setChatJoined(false);
        } else {
          setChatActive(false);
          setChatJoined(false);
        }
      },
    );

    const onMessage = (m) => {
      if (m && m.orderId === orderId && m.channel === channel) {
        setMessages((prev) => [...prev, m]);
      }
    };
    const onClosed = (d) => {
      if (d && d.orderId === orderId) setChatActive(false);
    };

    chatSocket.on('newOrderMessage', onMessage);
    chatSocket.on('chatClosed', onClosed);

    return () => {
      chatSocket.off('newOrderMessage', onMessage);
      chatSocket.off('chatClosed', onClosed);
    };
  }, [orderId, channel, chatSocket]);

  // Auto-scroll vers le bas du fil de discussion
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, channel]);

  const sendMessage = useCallback(() => {
    const text = chatInput.trim();
    if (!text || !chatActive || !chatJoined) return;
    chatSocket.emit('sendOrderMessage', { orderId, channel, message: text });
    setChatInput('');
  }, [chatInput, chatActive, chatJoined, chatSocket, orderId, channel]);

  const handleConfirmReceipt = useCallback(() => {
    const pin = window.prompt('Saisissez le Code PIN à 4 chiffres reçu :');
    if (!pin) return;
    api
      .clientValidateWithPin(orderId, pin)
      .then(() => navigate('/order-history'))
      .catch((e) => window.alert(e.message || 'Code PIN invalide'));
  }, [orderId, navigate]);

  const handleOpenDispute = async (reason, password) => {
    try {
      setDisputeError(null);
      await api.openDispute(orderId, { reason, password });
      setDisputeSuccess(true);
      setShowDisputeModal(false);
    } catch (err) {
      setDisputeError(err.message || "Impossible d'ouvrir le litige");
    }
  };

  const mapPoints = useMemo(() => {
    const pts = [];
    if (isRide) {
      if (tracking?.pickupLocation?.latitude != null) {
        pts.push([
          tracking.pickupLocation.latitude,
          tracking.pickupLocation.longitude,
        ]);
      }
    } else if (tracking?.businessLocation) {
      pts.push([
        tracking.businessLocation.latitude,
        tracking.businessLocation.longitude,
      ]);
    }
    if (tracking?.deliveryLocation) {
      pts.push([
        tracking.deliveryLocation.latitude,
        tracking.deliveryLocation.longitude,
      ]);
    }
    if (driverPos) pts.push(driverPos);
    return pts;
  }, [tracking, driverPos, isRide]);

  const tracePath = useMemo(
    () => (liveTrace.length > 1 ? liveTrace : []),
    [liveTrace],
  );

  const eta = tracking?.eta;

  return (
    <div className="app-page">
      <header className="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-background-secondary transition-colors"
            >
              <ArrowLeft
                size={18}
                className="text-text-primary"
                strokeWidth={1.5}
              />
            </button>
            <h1 className="text-lg font-display font-bold text-text-primary">
              Suivi de commande
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!error && !tracking && (
          <div className="py-16 text-center text-text-secondary">
            Chargement du suivi…
          </div>
        )}

        {tracking && (
          <>
            {/* Ordre + statut */}
            <div className="app-panel rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs text-text-secondary">
                    Numéro de commande
                  </p>
                  <p className="text-lg font-mono font-bold text-text-primary">
                    {orderId}
                  </p>
                </div>
                <span className="px-3 py-1 bg-background-secondary text-xs font-medium text-text-secondary">
                  {STATUS_LABELS[status] || status}
                </span>
              </div>

              <div className="relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-background-secondary">
                  <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${progress}%`, backgroundColor: '#C1652E' }}
                  />
                </div>
                <div className="flex justify-between mt-4">
                  {STEP_LABELS.slice(1).map((label, index) => (
                    <div
                      key={label}
                      className="flex flex-col items-center"
                    >
                      <div
                        className={`w-8 h-8 flex items-center justify-center border-2 transition-colors ${
                          index < step
                            ? 'bg-accent-primary border-accent-primary text-white'
                            : 'bg-background-secondary border-border-light text-text-secondary'
                        }`}
                        style={
                          index < step
                            ? { backgroundColor: '#C1652E', borderColor: '#C1652E' }
                            : {}
                        }
                      >
                        {index < step - 1 ? (
                          <Check size={14} strokeWidth={1.5} />
                        ) : (
                          <span className="text-xs font-medium">
                            {index + 1}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-text-secondary mt-2">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Estimateur de temps */}
            {eta && (
              <div className="border border-border-light p-4 mb-6">
                <div className="flex items-center gap-3">
                  <Clock
                    size={20}
                    className="text-accent-primary"
                    strokeWidth={1.5}
                  />
                  <div className="flex-1">
                    <p className="text-text-secondary text-xs">
                      {isRide
                        ? 'Temps de trajet estimé'
                        : 'Temps estimé (préparation + trajet)'}
                    </p>
                    <p className="text-text-primary font-medium text-xl">
                      {eta.totalMinutes} min
                      <span className="text-text-secondary text-xs font-normal ml-2">
                        arrivée vers{' '}
                        {new Date(eta.arrivalAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </p>
                    <p className="text-xs text-text-secondary mt-1">
                      {!isRide && (
                        <>
                          Préparation {eta.remainingPreparationMinutes} min ·{' '}
                        </>
                      )}
                      Trajet {eta.travelMinutes} min ·{' '}
                      {eta.distanceKm.toLocaleString('fr-FR')} km
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Carte live */}
            <div className="border border-border-light p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-text-secondary">
                  Position du {isRide ? 'chauffeur' : 'livreur'}
                </h2>
                {trackingActive ? (
                  <span className="flex items-center gap-1.5 text-xs text-success">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    Suivi en direct
                  </span>
                ) : (
                  <span className="text-xs text-text-secondary">
                    {isRide
                      ? "Le chauffeur n'est pas encore en route"
                      : "Le livreur n'est pas encore en route"}
                  </span>
                )}
              </div>
              <div
                className="w-full"
                style={{ height: 320, borderRadius: 8, overflow: 'hidden' }}
              >
                <MapContainer
                  center={mapPoints[0] || OUAGA}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FitBounds points={mapPoints} />
                  {tracePath.length > 0 && (
                    <Polyline
                      positions={tracePath}
                      pathOptions={{
                        color: '#C1652E',
                        weight: 4,
                        opacity: 0.7,
                      }}
                    />
                  )}
                  {isRide ? (
                    tracking?.pickupLocation?.latitude != null && (
                      <Marker
                        position={[
                          tracking.pickupLocation.latitude,
                          tracking.pickupLocation.longitude,
                        ]}
                        icon={PICKUP_ICON}
                      />
                    )
                  ) : (
                    tracking?.businessLocation && (
                      <Marker
                        position={[
                          tracking.businessLocation.latitude,
                          tracking.businessLocation.longitude,
                        ]}
                        icon={BUSINESS_ICON}
                      />
                    )
                  )}
                  {driverPos && <Marker position={driverPos} icon={DRIVER_ICON} />}
                  {tracking?.deliveryLocation && (
                    <Marker
                      position={[
                        tracking.deliveryLocation.latitude,
                        tracking.deliveryLocation.longitude,
                      ]}
                      icon={DELIVERY_ICON}
                    />
                  )}
                </MapContainer>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{
                      backgroundColor: isRide ? '#3B82F6' : '#6B7280',
                    }}
                  />
                  {isRide ? 'Départ' : 'Marchand'}
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: '#C1652E' }}
                  />
                  {isRide ? 'Chauffeur' : 'Livreur'}
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: '#5C6B3C' }}
                  />
                  {isRide ? 'Arrivée' : 'Livraison'}
                </span>
              </div>
            </div>

            {/* Chat éphémère */}
            <div className="border border-border-light p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-text-secondary flex items-center gap-2">
                  <MessageCircle size={16} strokeWidth={1.5} />
                  Discussion
                </h2>
                {!chatActive && (
                  <span className="text-xs text-text-secondary">
                    Canal archivé
                  </span>
                )}
              </div>

              {/* Choix du canal */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setChannel('driver')}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    channel === 'driver'
                      ? 'text-white'
                      : 'border border-border-light text-text-secondary'
                  }`}
                  style={
                    channel === 'driver' ? { backgroundColor: '#C1652E' } : {}
                  }
                >
                  Avec le {isRide ? 'chauffeur' : 'livreur'}
                </button>
                {!isRide && (
                  <button
                    onClick={() => setChannel('merchant')}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                      channel === 'merchant'
                        ? 'text-white'
                        : 'border border-border-light text-text-secondary'
                    }`}
                    style={
                      channel === 'merchant'
                        ? { backgroundColor: '#C1652E' }
                        : {}
                    }
                  >
                    Avec le marchand
                  </button>
                )}
              </div>

              <div
                ref={chatBoxRef}
                className="bg-background-primary rounded-lg p-3 h-48 overflow-y-auto mb-3 space-y-2"
              >
                {messages.length === 0 && (
                  <p className="text-xs text-text-secondary text-center pt-6">
                    {chatActive
                      ? 'Aucun message pour le moment.'
                      : 'Discussion terminée.'}
                  </p>
                )}
                {messages.map((m, i) => {
                  const mine = m.senderId === myUserId;
                  const senderLabel =
                    m.senderRole === 'DRIVER'
                      ? 'Livreur'
                      : m.senderRole === 'COURIER'
                        ? 'Coursier'
                        : m.senderRole === 'CLIENT'
                          ? 'Vous'
                          : 'Marchand';
                  return (
                    <div
                      key={m.id || `${m.senderId}-${m.timestamp}-${i}`}
                      className={`max-w-[80%] px-3 py-2 rounded-lg ${
                        mine
                          ? 'ml-auto text-white'
                          : 'bg-background-card border border-border-light text-text-primary'
                      }`}
                      style={mine ? { backgroundColor: '#C1652E' } : {}}
                    >
                      {!mine && (
                        <p className="text-[10px] text-text-secondary mb-0.5">
                          {senderLabel}
                        </p>
                      )}
                      <p className="text-sm">{m.message}</p>
                      <p
                        className={`text-[10px] mt-0.5 ${
                          mine ? 'text-white/70' : 'text-text-secondary'
                        }`}
                      >
                        {new Date(m.timestamp || m.createdAt).toLocaleTimeString(
                          'fr-FR',
                          { hour: '2-digit', minute: '2-digit' },
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  disabled={!chatActive || !chatJoined}
                  placeholder={
                    chatActive
                      ? 'Écrire un message…'
                      : 'Canal fermé'
                  }
                  className="flex-1 px-3 py-2.5 text-sm border border-border-light focus:outline-none focus:border-accent-primary disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={!chatActive || !chatJoined || !chatInput.trim()}
                  className="px-4 flex items-center justify-center text-white transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: '#C1652E' }}
                >
                  <Send size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Confirmation de réception (PIN) */}
            {status === 'DELIVERED_PENDING_CONFIRMATION' && (
              <div className="flex flex-col items-center bg-success/10 border border-success/30 p-6 mb-6">
                <CheckCircle
                  size={32}
                  className="text-success mb-2"
                  strokeWidth={1.5}
                />
                <p className="text-success font-medium">
                  {isRide
                    ? 'Le chauffeur est arrivé. Confirmez pour terminer votre course.'
                    : 'Le livreur a marqué votre commande comme livrée.'}
                </p>
                <button
                  onClick={handleConfirmReceipt}
                  className="mt-4 px-6 py-3 text-sm font-medium text-white transition-colors"
                  style={{ backgroundColor: '#5C6B3C' }}
                >
                  Confirmer la réception (Code PIN)
                </button>
              </div>
            )}

            {/* Signaler un problème */}
            {['DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED'].includes(status) && !disputeSuccess && (
              <div className="mb-6">
                {disputeError && (
                  <p className="text-sm text-red-500 mb-2">{disputeError}</p>
                )}
                <button
                  onClick={() => setShowDisputeModal(true)}
                  className="w-full px-4 py-3 text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 transition flex items-center justify-center gap-2"
                >
                  <AlertTriangle size={16} strokeWidth={1.5} />
                  Signaler un problème
                </button>
              </div>
            )}

            {disputeSuccess && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 text-sm text-center">
                Litige ouvert avec succès. Notre équipe va examiner votre dossier.
              </div>
            )}

            {status === 'DISPUTED' && (
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 text-orange-700 text-sm text-center">
                Un litige est en cours pour cette commande.
              </div>
            )}

            <DisputeModal
              isOpen={showDisputeModal}
              onClose={() => setShowDisputeModal(false)}
              onSubmit={handleOpenDispute}
              orderId={orderId}
            />

            <div className="flex gap-3">
              <button
                onClick={() => navigate('/order-history')}
                className="flex-1 px-4 py-3 text-sm font-medium border border-border-light text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-colors"
              >
                Historique
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex-1 px-4 py-3 text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: '#C1652E' }}
              >
                Commander
              </button>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default OrderTracking;
