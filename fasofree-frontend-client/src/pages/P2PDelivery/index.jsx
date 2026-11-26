/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, AlertCircle, LockKeyhole } from 'lucide-react';
import Footer from '../../components/Footer';
import { api } from '../../services/api';
import useAuthStore from '../../store/authStore';
import { STEPS, emptyLocation, emptyPackage } from './constants';
import { formatBurkinaPhone } from '../../utils/phone';
import { estimateP2PPrice } from '../../utils/p2pPricing';
import LocationStep from './LocationStep';
import PackageStep from './PackageStep';
import DeliveryTicket from './DeliveryTicket';
import DeliveryGlyph, { DELIVERY_SERVICES } from '../../components/DeliveryGlyph';

// Brouillon conservé dans cet onglet pour reprendre la saisie sans compte.
const P2P_DRAFT_KEY = 'fasofree_p2p_draft';

function hasDeliveryPoint(location) {
  return ['map', 'gps'].includes(location.locationSource)
    && Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
}

function readDraft(key) {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key));
    if (draft?.pickup && draft.dropoff && draft.packageInfo) {
      const dropoff = draft.dropoff.locationSource === 'gps' ? {
        ...draft.dropoff,
        latitude: emptyLocation.latitude,
        longitude: emptyLocation.longitude,
        locationSource: emptyLocation.locationSource,
        address: draft.dropoff.address === 'Position actuelle (GPS)' ? '' : draft.dropoff.address,
      } : draft.dropoff;
      return { ...draft, dropoff };
    }
  } catch {
    /* Le formulaire fonctionne aussi sans stockage local. */
  }
  return { step: 1, pickup: emptyLocation, dropoff: emptyLocation, packageInfo: emptyPackage };
}

function checkoutErrorMessage(error) {
  if (error?.code === 'NETWORK_ERROR' || error?.status >= 500) {
    return 'Le service d’envoi est momentanément indisponible. Votre brouillon est conservé. Réessayez dans un instant.';
  }
  if (error?.status === 404) {
    return 'L’envoi est indisponible sur cette version du serveur. Votre brouillon est conservé.';
  }
  if (error?.status === 429) {
    return 'Trop de tentatives. Patientez une minute avant de réessayer.';
  }
  return error?.message || 'Impossible de soumettre votre course. Réessayez dans un instant.';
}

const P2PDelivery = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deliveryMode = searchParams.get('mode') === 'merchant-pickup' ? 'merchant-pickup' : 'parcel';
  const isMerchantPickup = deliveryMode === 'merchant-pickup';
  const draftKey = `${P2P_DRAFT_KEY}_${deliveryMode}`;
  const { isAuthenticated } = useAuthStore();
  const [draft] = useState(() => readDraft(draftKey));
  const [step, setStep] = useState(draft.step);
  const [pickup, setPickup] = useState(draft.pickup);
  const [dropoff, setDropoff] = useState(draft.dropoff);
  const [packageInfo, setPackageInfo] = useState(draft.packageInfo);
  const [guestEmail, setGuestEmail] = useState(draft.guestEmail || '');
  const [guestPhone, setGuestPhone] = useState(draft.guestPhone);
  const checkoutAttempt = useRef(draft.checkoutAttempt);
  const payerContact = isMerchantPickup ? dropoff : pickup;
  const payerPhone = guestPhone ?? payerContact.contactPhone;
  const [submitting, setSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ step, pickup, dropoff, packageInfo, guestEmail, guestPhone, checkoutAttempt: checkoutAttempt.current }));
    } catch {
      /* Le formulaire fonctionne aussi sans stockage local. */
    }
  }, [draftKey, step, pickup, dropoff, packageInfo, guestEmail, guestPhone]);


  const hasPickupPoint = hasDeliveryPoint(pickup);
  const hasDropoffPoint = hasDeliveryPoint(dropoff);
  const missingPointStep = !hasPickupPoint ? 1 : !hasDropoffPoint ? 2 : null;
  const priceEstimate = useMemo(
    () => missingPointStep ? null : estimateP2PPrice(pickup, dropoff, packageInfo.isFragile, packageInfo.weight),
    [missingPointStep, pickup.latitude, pickup.longitude, dropoff.latitude, dropoff.longitude, packageInfo.isFragile, packageInfo.weight],
  );

  const updateLocation = (setter, field, value) =>
    setter((prev) => ({
      ...prev,
      [field]: value,
      locationSource: field === 'address' && prev.address.trim() && prev.address.trim() !== value.trim()
        ? 'approximate'
        : prev.locationSource,
    }));

  const selectPoint = (setter, { lat, lng }) =>
    setter((prev) => ({ ...prev, latitude: lat, longitude: lng, locationSource: 'map' }));

  const applySavedAddress = (setter, saved) => {
    const hasPoint = saved.latitude != null && saved.longitude != null
      && Number.isFinite(Number(saved.latitude)) && Number.isFinite(Number(saved.longitude));
    setter((prev) => ({
      ...prev,
      address: saved.address,
      latitude: hasPoint ? Number(saved.latitude) : emptyLocation.latitude,
      longitude: hasPoint ? Number(saved.longitude) : emptyLocation.longitude,
      locationSource: hasPoint ? 'map' : emptyLocation.locationSource,
    }));
  };

  const updatePackage = (field, value) =>
    setPackageInfo((prev) => ({ ...prev, [field]: value }));

  const isStepValid = (current) => {
    if (current === 1) {
      const hasCoords = pickup.latitude != null && pickup.longitude != null &&
        !isNaN(Number(pickup.latitude)) && !isNaN(Number(pickup.longitude));
      const hasPickupReference = !isMerchantPickup || pickup.instructions.trim();
      return (
        pickup.address.trim() &&
        pickup.contactName.trim() &&
        pickup.contactPhone.trim() &&
        !!formatBurkinaPhone(pickup.contactPhone) &&
        hasCoords &&
        hasPickupReference
      );
    }
    if (current === 2) {
      const hasCoords = dropoff.latitude != null && dropoff.longitude != null &&
        !isNaN(Number(dropoff.latitude)) && !isNaN(Number(dropoff.longitude));
      return (
        dropoff.address.trim() &&
        dropoff.contactName.trim() &&
        dropoff.contactPhone.trim() &&
        !!formatBurkinaPhone(dropoff.contactPhone) &&
        hasCoords
      );
    }
    return packageInfo.description.trim() && packageInfo.estimatedAmount.trim();
  };

  const goToStep = (nextStep) => {
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleNext = () => {
    setError('');
    if (!isStepValid(step)) {
      setError('Veuillez remplir tous les champs obligatoires de cette étape.');
      return;
    }
    if (step === 1 && !hasPickupPoint) {
      setError('Confirmez le point de ramassage sur la carte pour continuer.');
      return;
    }
    if (step === 2 && !hasDropoffPoint) {
      setError('Confirmez le point de remise sur la carte pour continuer.');
      return;
    }
    goToStep(Math.min(step + 1, 3));
  };

  const handleBack = () => {
    setError('');
    goToStep(Math.max(step - 1, 1));
  };

  const showMissingPoint = () => {
    setError(missingPointStep === 1 ? 'Placez le point de départ sur la carte.' : 'Placez le point de remise sur la carte.');
    goToStep(missingPointStep);
  };

  const buildPayload = () => ({
    orderType: 'P2P_DELIVERY',
    pickupLocation: {
      address: pickup.address,
      latitude: Number(pickup.latitude),
      longitude: Number(pickup.longitude),
      contactName: pickup.contactName,
      contactPhone: formatBurkinaPhone(pickup.contactPhone) || pickup.contactPhone,
      instructions: pickup.instructions || undefined,
    },
    dropoffLocation: {
      address: dropoff.address,
      latitude: Number(dropoff.latitude),
      longitude: Number(dropoff.longitude),
      contactName: dropoff.contactName,
      contactPhone: formatBurkinaPhone(dropoff.contactPhone) || dropoff.contactPhone,
      instructions: dropoff.instructions || undefined,
    },
    packageDetails: {
      description: packageInfo.description,
      isFragile: packageInfo.isFragile,
      weight: packageInfo.weight ? Number(packageInfo.weight) : undefined,
      estimatedValue: packageInfo.estimatedAmount ? Number(packageInfo.estimatedAmount) : undefined,
      dimensions:
        packageInfo.length || packageInfo.width || packageInfo.height
          ? {
              length: packageInfo.length ? Number(packageInfo.length) : undefined,
              width: packageInfo.width ? Number(packageInfo.width) : undefined,
              height: packageInfo.height ? Number(packageInfo.height) : undefined,
            }
          : undefined,
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submissionInFlight.current) return;
    if (step < 3) {
      handleNext();
      return;
    }
    setError('');
    if (missingPointStep) {
      showMissingPoint();
      return;
    }
    if (!isStepValid(3)) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    const phone = formatBurkinaPhone(payerPhone);
    if (!isAuthenticated && (!guestEmail.trim() || !phone)) {
      setError('Renseignez votre e-mail et un numéro burkinabè valide pour payer sans compte.');
      return;
    }

    submissionInFlight.current = true;
    setSubmitting(true);
    try {
      const payload = buildPayload();
      let response;
      if (isAuthenticated) {
        response = await api.createOrder(payload);
      } else {
        const { pickupLocation, dropoffLocation, packageDetails } = payload;
        const guest = { pickupLocation, dropoffLocation, packageDetails, email: guestEmail.trim(), phone, name: payerContact.contactName.trim() };
        const snapshot = JSON.stringify(guest);
        if (checkoutAttempt.current?.snapshot !== snapshot) {
          const bytes = crypto.getRandomValues(new Uint8Array(32));
          const key = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
          checkoutAttempt.current = { key, snapshot };
        }
        try {
          sessionStorage.setItem(draftKey, JSON.stringify({
            step, pickup, dropoff, packageInfo, guestEmail, guestPhone, checkoutAttempt: checkoutAttempt.current,
          }));
        } catch {
          /* Le paiement reste possible dans la session courante. */
        }
        response = await api.createGuestDelivery({ ...guest, checkoutKey: checkoutAttempt.current.key });
      }

      const orderId = response?.order?.id || response?.orderId;
      if (!orderId) throw new Error('La course n’a pas pu être enregistrée.');
      try {
        if (response.trackingToken) sessionStorage.setItem('fasofree_tracking_token', response.trackingToken);
        if (isAuthenticated) sessionStorage.removeItem(draftKey);
        else sessionStorage.setItem(`koliwa_checkout_${orderId}`, draftKey);
      } catch {
        /* Le lien de retour du paiement contient les informations de suivi. */
      }

      if (response.checkoutUrl) {
        window.location.assign(response.checkoutUrl);
        return;
      }
      const query = new URLSearchParams({ orderId });
      if (response.trackingToken) query.set('trackingToken', response.trackingToken);
      const reference = response.trackingReference || response.order?.trackingReference;
      if (reference) query.set('reference', reference);
      navigate(`/p2p/success?${query}`, { replace: true });
    } catch (err) {
      if (!isAuthenticated && err?.status === 410) {
        checkoutAttempt.current = null;
        try {
          sessionStorage.setItem(draftKey, JSON.stringify({ step, pickup, dropoff, packageInfo, guestEmail, guestPhone }));
        } catch {
          /* Le brouillon reste disponible à l’écran. */
        }
      }
      setError(checkoutErrorMessage(err));
    } finally {
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="app-page p2p-page">
      <div className="client-screen-frame">
        <header className="shipment-heading">
          <div className="shipment-title">
            <span className="shipment-heading-glyph">
              <DeliveryGlyph kind={isMerchantPickup ? 'pickup' : 'parcel'} />
            </span>
            <h1>{isMerchantPickup ? 'Faire récupérer un colis' : 'Envoyer un colis'}</h1>
          </div>
          <nav className="p2p-mode-switch" aria-label="Service de livraison">
            {DELIVERY_SERVICES.map(({ kind, title, to }) => (
              <Link key={kind} to={to} aria-current={(kind === 'pickup') === isMerchantPickup ? 'page' : undefined}>
                <DeliveryGlyph kind={kind} /> {title}
              </Link>
            ))}
          </nav>
        </header>

        <ol className="p2p-steps" aria-label="Étapes de la demande">
          {STEPS.map(({ id, label }) => (
            <li key={id} className="p2p-step" aria-current={step === id ? 'step' : undefined} data-complete={step > id}>
              <span className="p2p-step-number" aria-hidden={step > id}>{step > id ? <Check size={13} /> : id}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        <form onSubmit={handleSubmit} className="p2p-form">
          <div className="p2p-step-fields">
            {step === 1 && (
              <LocationStep
                title={isMerchantPickup ? 'Point de retrait' : 'Point de ramassage'}
                contactLabel={isMerchantPickup ? 'Nom du commerçant' : 'Nom du contact'}
                phoneLabel={isMerchantPickup ? 'Téléphone du commerce' : 'Téléphone du contact'}
                value={pickup}
                onUpdate={(field, value) => updateLocation(setPickup, field, value)}
                allowCurrentLocation={!isMerchantPickup}
                onSelectPoint={(point) => selectPoint(setPickup, point)}
                onSavedAddress={(address) => applySavedAddress(setPickup, address)}
                isMerchantPickup={isMerchantPickup}
              />
            )}
            {step === 2 && (
              <LocationStep
                title="Point de remise"
                contactLabel="Nom du destinataire"
                phoneLabel="Téléphone du destinataire"
                value={dropoff}
                onUpdate={(field, value) => updateLocation(setDropoff, field, value)}
                onSelectPoint={(point) => selectPoint(setDropoff, point)}
                onSavedAddress={(address) => applySavedAddress(setDropoff, address)}
              />
            )}
            {step === 3 && <PackageStep value={packageInfo} onUpdate={updatePackage} />}
          </div>

          <DeliveryTicket pickup={pickup} dropoff={dropoff} estimate={priceEstimate} showPrice={step === 3} />

          {step === 3 && !isAuthenticated && (
            <section className="app-panel p2p-payment-panel" aria-labelledby="guest-payment-title">
              <div className="p2p-payment-heading">
                <LockKeyhole size={19} aria-hidden="true" />
                <h2 id="guest-payment-title">Payer sans compte</h2>
              </div>
              <p>Indiquez l’e-mail et le numéro de la personne qui paie la livraison.</p>
              <div className="p2p-fields">
                <label>
                  <span>Adresse e-mail</span>
                  <input type="email" className="app-input" required maxLength={254} autoComplete="email" value={guestEmail} onChange={event => setGuestEmail(event.target.value)} />
                </label>
                <label>
                  <span>Téléphone du payeur</span>
                  <input type="tel" className="app-input" required maxLength={14} autoComplete="tel" value={payerPhone} onChange={event => setGuestPhone(event.target.value)} />
                </label>
              </div>
            </section>
          )}

          <div className="p2p-form-bottom">
            {error && (
              <div className="p2p-form-error" role="alert">
                <AlertCircle size={18} aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            <div className="p2p-step-actions">
              {step > 1 && (
                <button type="button" className="app-action-secondary" onClick={handleBack} disabled={submitting}>
                  <ArrowLeft size={16} aria-hidden="true" /> Précédent
                </button>
              )}
              {step < 3 ? (
                <button type="button" className="app-action" onClick={handleNext}>
                  Continuer <ArrowRight size={17} aria-hidden="true" />
                </button>
              ) : missingPointStep ? (
                <button type="button" className="app-action" onClick={showMissingPoint}>
                  Placer le point {missingPointStep === 1 ? 'de départ' : 'de remise'} <ArrowRight size={17} aria-hidden="true" />
                </button>
              ) : (
                <button type="submit" className="app-action" disabled={submitting}>
                  {submitting ? 'Préparation du paiement…' : (
                    <>{isAuthenticated ? 'Confirmer la course' : 'Passer au paiement'} <ArrowRight size={17} aria-hidden="true" /></>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
      <Footer />
    </div>
  );
};


export default P2PDelivery;
