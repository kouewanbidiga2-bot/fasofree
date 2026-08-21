import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Boxes, AlertCircle, Info } from 'lucide-react';
import Footer from '../../components/Footer';
import { api } from '../../services/api';
import { STEPS, emptyLocation, emptyPackage } from './constants';
import { formatBurkinaPhone } from '../../utils/phone';
import { estimateP2PPrice } from '../../utils/p2pPricing';
import LocationStep from './LocationStep';
import PackageStep from './PackageStep';
import SuccessScreen from './SuccessScreen';

const P2PDelivery = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [pickup, setPickup] = useState(emptyLocation);
  const [dropoff, setDropoff] = useState(emptyLocation);
  const [packageInfo, setPackageInfo] = useState(emptyPackage);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  // Estimation client-side du prix P2P (Haversine + formule backend)
  const priceEstimate = useMemo(
    () =>
      estimateP2PPrice(pickup, dropoff, packageInfo.isFragile, packageInfo.weight),
    [pickup.latitude, pickup.longitude, dropoff.latitude, dropoff.longitude, packageInfo.isFragile, packageInfo.weight],
  );

  const updateLocation = (setter, field, value) =>
    setter((prev) => ({ ...prev, [field]: value }));

  const updatePackage = (field, value) =>
    setPackageInfo((prev) => ({ ...prev, [field]: value }));

  // Récupère la position GPS du navigateur et remplit le lieu concerné
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
      () => alert('Impossible de récupérer votre position')
    );
  };

  const isStepValid = (current) => {
    if (current === 1) {
      return (
        pickup.address.trim() &&
        pickup.contactName.trim() &&
        pickup.contactPhone.trim() &&
        !!formatBurkinaPhone(pickup.contactPhone)
      );
    }
    if (current === 2) {
      return (
        dropoff.address.trim() &&
        dropoff.contactName.trim() &&
        dropoff.contactPhone.trim() &&
        !!formatBurkinaPhone(dropoff.contactPhone)
      );
    }
    return packageInfo.description.trim() && packageInfo.estimatedAmount.trim();
  };

  const handleNext = () => {
    setError('');
    if (!isStepValid(step)) {
      setError('Veuillez remplir tous les champs obligatoires de cette étape.');
      return;
    }
    setStep((prev) => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setError('');
    setStep((prev) => Math.max(prev - 1, 1));
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
    setError('');
    if (!isStepValid(3)) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await api.createOrder(buildPayload());
      setSuccess({
        id: response?.orderId || response?.id || 'FF' + Date.now().toString().slice(-8),
      });
    } catch (err) {
      setError(
        err?.message ||
          'Impossible de soumettre votre course. Vérifiez que vous êtes connecté et réessayez.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSuccess(null);
    setPickup(emptyLocation);
    setDropoff(emptyLocation);
    setPackageInfo(emptyPackage);
    setStep(1);
  };

  // ─── Écran de confirmation ───────────────────────────────────────────
  if (success) {
    return <SuccessScreen orderRef={success.id} onReset={resetForm} />;
  }

  // ─── Formulaire en 3 étapes ──────────────────────────────────────────
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
              <h1 className="text-lg font-display font-bold text-text-primary">Envoyer un colis</h1>
              <p className="text-xs text-text-secondary">Course à la demande · Point A vers Point B</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Indicateur d'étapes */}
        <ol className="mb-8 flex items-center gap-2">
          {STEPS.map((s, i) => {
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <React.Fragment key={s.id}>
                {i > 0 && (
                  <li aria-hidden="true" className="h-px flex-1 bg-border-light" />
                )}
                <li
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                      : isDone
                      ? 'border-status-success/30 bg-status-success/10 text-status-success'
                      : 'border-border-light bg-background-card text-text-secondary'
                  }`}
                >
                  <span>{isDone ? <Check size={14} /> : s.icon ? <s.icon size={14} /> : s.id}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </li>
              </React.Fragment>
            );
          })}
        </ol>

        <form onSubmit={handleSubmit}>
          {/* ─── ÉTAPE 1 : RAMASSAGE ─── */}
          {step === 1 && (
            <LocationStep
              title="Adresse de ramassage"
              contactLabel="Nom du contact"
              phoneLabel="Téléphone du contact"
              value={pickup}
              onUpdate={(field, value) => updateLocation(setPickup, field, value)}
              onUseCurrentLocation={() => handleUseCurrentLocation(setPickup)}
            />
          )}

          {/* ─── ÉTAPE 2 : LIVRAISON ─── */}
          {step === 2 && (
            <LocationStep
              title="Adresse de livraison"
              contactLabel="Nom du destinataire"
              phoneLabel="Téléphone du destinataire"
              value={dropoff}
              onUpdate={(field, value) => updateLocation(setDropoff, field, value)}
              onUseCurrentLocation={() => handleUseCurrentLocation(setDropoff)}
            />
          )}

          {/* ─── ÉTAPE 3 : COLIS & CONTACT ─── */}
          {step === 3 && (
            <PackageStep value={packageInfo} onUpdate={updatePackage} />
          )}

          {/* ─── ESTIMATION PRIX (affichée à partir de l'étape 3) ─── */}
          {step === 3 && priceEstimate && (
            <div className="app-panel rounded-lg p-5 mb-6 border border-accent-primary/20 bg-accent-primary/5 fade-in">
              <div className="flex items-center gap-2 mb-3">
                <Info size={15} className="text-accent-primary" />
                <h3 className="text-sm font-semibold text-text-primary">Estimation du tarif</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-text-tertiary">Distance</span>
                  <p className="font-semibold text-text-primary">{priceEstimate.distance} km</p>
                </div>
                <div>
                  <span className="text-text-tertiary">Frais de livraison</span>
                  <p className="font-semibold text-accent-primary text-base">
                    {priceEstimate.price.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
                <div>
                  <span className="text-text-tertiary">Base</span>
                  <p className="text-text-secondary">{priceEstimate.breakdown.basePrice} FCFA</p>
                </div>
                <div>
                  <span className="text-text-tertiary">Distance ({priceEstimate.distance} km)</span>
                  <p className="text-text-secondary">{priceEstimate.breakdown.distancePrice} FCFA</p>
                </div>
                {priceEstimate.breakdown.fragileSurcharge > 0 && (
                  <div>
                    <span className="text-text-tertiary">Surcoût fragile</span>
                    <p className="text-text-secondary">{priceEstimate.breakdown.fragileSurcharge} FCFA</p>
                  </div>
                )}
                {priceEstimate.breakdown.weightSurcharge > 0 && (
                  <div>
                    <span className="text-text-tertiary">Surcoût poids</span>
                    <p className="text-text-secondary">{priceEstimate.breakdown.weightSurcharge} FCFA</p>
                  </div>
                )}
              </div>
              <p className="mt-3 text-[11px] text-text-tertiary">
                Le montant final est calculé côté serveur et peut varier légèrement. Frais de service : 100 FCFA.
              </p>
            </div>
          )}

          {step === 3 && !priceEstimate && (
            <div className="mb-6 p-4 rounded-lg border border-status-warning/30 bg-status-warning/10 text-xs text-status-warning">
              Renseignez les adresses aux étapes 1 et 2 pour obtenir une estimation du tarif.
            </div>
          )}

          {/* Erreur éventuelle */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-md border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Navigation des étapes */}
          <div className="flex items-center justify-between gap-4">
            {step > 1 ? (
              <button
                type="button"
                className="app-action-secondary"
                onClick={handleBack}
              >
                <ArrowLeft size={16} /> Précédent
              </button>
            ) : (
              <span />
            )}

            {step < 3 ? (
              <button
                type="button"
                className="app-action gap-2"
                onClick={handleNext}
              >
                Continuer <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="submit"
                className="app-action gap-2"
                disabled={submitting}
              >
                {submitting ? 'Envoi en cours...' : (
                  <>
                    <Boxes size={16} /> Confirmer la course
                  </>
                )}
              </button>
            )}
          </div>
        </form>

        <p className="mt-8 flex items-start gap-2 text-xs leading-5 text-text-tertiary">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          Un livreur vérifié sera assigné automatiquement. Le paiement s'effectuera à la
          confirmation de la course. Les champs marqués d'une * sont obligatoires.
        </p>
      </div>

      <Footer />
    </div>
  );
};

export default P2PDelivery;
