import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Lock,
  ArrowLeft,
  Store,
  Bike,
  MapPin,
  Upload,
  CheckCircle2,
  Home,
  Car,
  CreditCard,
} from 'lucide-react';
import { api } from '../services/api';
import useAuthStore from '../store/authStore';

const ACCENT = '#C1652E';

const BUSINESS_CATEGORIES = [
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'SUPERMARKET', label: 'Supermarché / Épicerie' },
  { value: 'PHARMACY', label: 'Pharmacie' },
  { value: 'RETAIL', label: 'Boutique / Retail' },
  { value: 'BAKERY', label: 'Boulangerie' },
  { value: 'SERVICES', label: 'Services' },
];

const VEHICLE_TYPES = [
  { value: 'MOTORCYCLE', label: 'Moto' },
  { value: 'CAR', label: 'Voiture' },
  { value: 'BICYCLE', label: 'Vélo' },
];

const TABS = [
  { id: 'client', label: 'Client', icon: User, hint: 'Commander et se faire livrer' },
  { id: 'merchant', label: 'Marchand', icon: Store, hint: 'Vendre sur la plateforme' },
  { id: 'driver', label: 'Livreur', icon: Bike, hint: 'Livrer et gagner de l’argent' },
];

const KYC_FILE_TYPES = { identityCard: 'image/*,.pdf', driverLicense: 'image/*,.pdf', vehicleRegistration: 'image/*,.pdf' };

const KYC_LABELS = {
  identityCard: 'Pièce d’identité (CNI / Passeport)',
  driverLicense: 'Permis de conduire',
  vehicleRegistration: 'Carte grise / Assur. véhicule',
};

const emptyFiles = { identityCard: null, driverLicense: null, vehicleRegistration: null };

const Register = () => {
  const navigate = useNavigate();
  const { loginWithToken } = useAuthStore();

  const [activeTab, setActiveTab] = useState('client');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
    businessName: '',
    businessAddress: '',
    businessCategory: 'RESTAURANT',
    latitude: '',
    longitude: '',
    vehicleType: 'MOTORCYCLE',
    driverLicenseNumber: '',
  });
  const [files, setFiles] = useState(emptyFiles);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [locating, setLocating] = useState(false);
  const [success, setSuccess] = useState(null);

  const set = (field, value) => setFormData((d) => ({ ...d, [field]: value }));

  const validateCommon = (minPassword) => {
    const newErrors = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Le nom complet est requis';
    if (!formData.email.trim()) {
      newErrors.email = 'L’email est requis';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Le numéro de téléphone est requis';
    } else if (!/^\+?[0-9\s]{10,}$/.test(formData.phone)) {
      newErrors.phone = 'Numéro de téléphone invalide';
    }
    if (!formData.password) {
      newErrors.password = 'Le mot de passe est requis';
    } else if (formData.password.length < minPassword) {
      newErrors.password = `Le mot de passe doit contenir au moins ${minPassword} caractères`;
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    return newErrors;
  };

  const validateForm = () => {
    if (activeTab === 'client') return validateCommon(8);

    const newErrors = validateCommon(8);
    if (activeTab === 'merchant') {
      if (!formData.businessName.trim()) newErrors.businessName = 'Le nom du commerce est requis';
      if (!formData.businessAddress.trim()) newErrors.businessAddress = 'L’adresse du commerce est requise';
    }
    if (activeTab === 'driver' && !formData.vehicleType) {
      newErrors.vehicleType = 'Choisissez votre type de véhicule';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setErrors((e) => ({ ...e, location: 'Géolocalisation indisponible sur ce navigateur' }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('latitude', String(pos.coords.latitude.toFixed(6)));
        set('longitude', String(pos.coords.longitude.toFixed(6)));
        setErrors((e) => ({ ...e, location: '' }));
        setLocating(false);
      },
      () => {
        setErrors((e) => ({ ...e, location: 'Position indisponible, saisissez les coordonnées manuellement' }));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleClientRegister = async () => {
    const response = await api.register({
      fullName: formData.fullName,
      phone: formData.phone,
      email: formData.email,
      password: formData.password,
      referralCode: formData.referralCode || undefined,
    });

    if (response.access_token) {
      const user = response.user || {};
      const nameParts = (user.fullName || '').split(' ');
      loginWithToken(response.access_token, {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        role: user.role,
        isPremium: !!user.isPremium,
      });
      navigate('/');
    }
  };

  const handleApply = async () => {
    const fd = new FormData();
    fd.append('fullName', formData.fullName);
    fd.append('email', formData.email);
    fd.append('phone', formData.phone);
    fd.append('password', formData.password);
    fd.append('role', activeTab === 'merchant' ? 'MERCHANT' : 'DRIVER');
    if (formData.referralCode) fd.append('referralCode', formData.referralCode);

    if (activeTab === 'merchant') {
      fd.append('businessName', formData.businessName);
      fd.append('businessAddress', formData.businessAddress);
      fd.append('businessCategory', formData.businessCategory);
      if (formData.latitude && formData.longitude) {
        fd.append('latitude', formData.latitude);
        fd.append('longitude', formData.longitude);
      }
      if (files.identityCard) fd.append('identityCard', files.identityCard);
      if (files.vehicleRegistration) fd.append('vehicleRegistration', files.vehicleRegistration);
    } else {
      fd.append('vehicleType', formData.vehicleType);
      if (formData.driverLicenseNumber) fd.append('driverLicenseNumber', formData.driverLicenseNumber);
      if (files.identityCard) fd.append('identityCard', files.identityCard);
      if (files.driverLicense) fd.append('driverLicense', files.driverLicense);
      if (files.vehicleRegistration) fd.append('vehicleRegistration', files.vehicleRegistration);
    }

    const response = await api.apply(fd);
    setSuccess({ role: activeTab === 'merchant' ? 'Marchand' : 'Livreur', applicationId: response.applicationId });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const valid = validateForm();
    if (!valid) return;

    setLoading(true);
    try {
      if (activeTab === 'client') {
        await handleClientRegister();
      } else {
        await handleApply();
      }
    } catch (err) {
      setSubmitError(err.message || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) =>
    `w-full pl-12 pr-4 py-3 bg-background-secondary border-0 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none transition-colors ${
      errors[field] ? 'ring-2 ring-red-500' : ''
    }`;

  const plainInputClass = (field) =>
    `w-full px-4 py-3 bg-background-secondary border-0 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none transition-colors ${
      errors[field] ? 'ring-2 ring-red-500' : ''
    }`;

  const selectClass = (field) =>
    `w-full px-4 py-3 bg-background-secondary border-0 text-sm text-text-primary focus:outline-none transition-colors ${
      errors[field] ? 'ring-2 ring-red-500' : ''
    }`;

  // ─── Écran de succès (candidature envoyée) ─────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6 animate-scale-in">
            <CheckCircle2 size={44} className="text-success" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-display font-bold text-text-primary mb-3">
            Candidature envoyée !
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed mb-6">
            Merci pour votre confiance. Notre équipe examine votre dossier de{' '}
            <span className="font-medium text-text-primary">{success.role}</span>. Une fois validé,
            vous recevrez vos identifiants de connexion par SMS.
          </p>
          <div className="bg-background-secondary rounded-lg px-4 py-3 mb-6 text-xs text-text-secondary">
            Référence de dossier : <span className="font-mono font-medium text-text-primary">{success.applicationId.slice(0, 8).toUpperCase()}</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white rounded-lg transition-colors"
            style={{ backgroundColor: ACCENT }}
          >
            <Home size={16} strokeWidth={1.5} />
            Retour à l’accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-background-secondary transition-colors"
            >
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg font-display font-bold text-text-primary">Créer un compte</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-display font-bold text-text-primary mb-2">Rejoignez FasoFree</h2>
          <p className="text-text-secondary text-sm">
            Créez votre compte et choisissez votre profil : client, marchand ou livreur.
          </p>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setErrors({});
                  setSubmitError('');
                }}
                className={`rounded-lg border p-4 text-left transition-all ${
                  active
                    ? 'border-2 shadow-subtle'
                    : 'border-border-light hover:border-border-medium'
                }`}
                style={active ? { borderColor: ACCENT, backgroundColor: '#FDF3EA' } : undefined}
              >
                <Icon
                  size={22}
                  className="mb-2"
                  strokeWidth={1.5}
                  style={{ color: active ? ACCENT : '#74695F' }}
                />
                <p className="text-sm font-semibold text-text-primary">{tab.label}</p>
                <p className="text-[11px] text-text-secondary mt-0.5">{tab.hint}</p>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ─── Champs communs ─── */}
          <div>
            <label className="block text-xs text-text-secondary mb-2">Nom complet</label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Votre nom complet"
                value={formData.fullName}
                onChange={(e) => set('fullName', e.target.value)}
                className={inputClass('fullName')}
              />
            </div>
            {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-2">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} />
              <input
                type="email"
                placeholder="votre@email.com"
                value={formData.email}
                onChange={(e) => set('email', e.target.value)}
                className={inputClass('email')}
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-2">Numéro de téléphone</label>
            <div className="relative">
              <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} />
              <input
                type="tel"
                placeholder="+226 XX XX XX XX"
                value={formData.phone}
                onChange={(e) => set('phone', e.target.value)}
                className={inputClass('phone')}
              />
            </div>
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>

          {/* ─── Champs spécifiques ─── */}
          {activeTab === 'merchant' && (
            <>
              <div className="rounded-lg border border-border-light p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Store size={16} className="text-text-secondary" strokeWidth={1.5} />
                  <p className="text-xs font-semibold text-text-primary uppercase tracking-wide">Votre commerce</p>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Nom du commerce</label>
                  <input
                    type="text"
                    placeholder="Ex : Restaurant Le Terroir"
                    value={formData.businessName}
                    onChange={(e) => set('businessName', e.target.value)}
                    className={plainInputClass('businessName')}
                  />
                  {errors.businessName && <p className="text-xs text-red-500 mt-1">{errors.businessName}</p>}
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Adresse du commerce</label>
                  <input
                    type="text"
                    placeholder="Quartier, avenue, repère…"
                    value={formData.businessAddress}
                    onChange={(e) => set('businessAddress', e.target.value)}
                    className={plainInputClass('businessAddress')}
                  />
                  {errors.businessAddress && <p className="text-xs text-red-500 mt-1">{errors.businessAddress}</p>}
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Catégorie</label>
                  <select
                    value={formData.businessCategory}
                    onChange={(e) => set('businessCategory', e.target.value)}
                    className={selectClass('businessCategory')}
                  >
                    {BUSINESS_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">
                    Localisation <span className="text-text-muted">(facultatif)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={detectLocation}
                      disabled={locating}
                      className="inline-flex items-center gap-2 px-3 py-2.5 text-xs font-medium rounded-lg border border-border-medium text-text-primary hover:bg-background-secondary transition-colors disabled:opacity-50"
                    >
                      <MapPin size={14} strokeWidth={1.5} />
                      {locating ? 'Localisation…' : 'Me localiser'}
                    </button>
                    <input
                      type="text"
                      placeholder="Latitude"
                      value={formData.latitude}
                      onChange={(e) => set('latitude', e.target.value)}
                      className={plainInputClass('latitude')}
                    />
                    <input
                      type="text"
                      placeholder="Longitude"
                      value={formData.longitude}
                      onChange={(e) => set('longitude', e.target.value)}
                      className={plainInputClass('longitude')}
                    />
                  </div>
                  {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
                </div>
              </div>
            </>
          )}

          {activeTab === 'driver' && (
            <>
              <div className="rounded-lg border border-border-light p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Bike size={16} className="text-text-secondary" strokeWidth={1.5} />
                  <p className="text-xs font-semibold text-text-primary uppercase tracking-wide">Votre profil de livreur</p>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Type de véhicule</label>
                  <select
                    value={formData.vehicleType}
                    onChange={(e) => set('vehicleType', e.target.value)}
                    className={selectClass('vehicleType')}
                  >
                    {VEHICLE_TYPES.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                  {errors.vehicleType && <p className="text-xs text-red-500 mt-1">{errors.vehicleType}</p>}
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">
                    Numéro de permis <span className="text-text-muted">(facultatif)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : BF-123-456"
                    value={formData.driverLicenseNumber}
                    onChange={(e) => set('driverLicenseNumber', e.target.value)}
                    className={plainInputClass('driverLicenseNumber')}
                  />
                </div>
              </div>
            </>
          )}

          {/* ─── Documents KYC ─── */}
          {activeTab !== 'client' && (
            <div className="rounded-lg border border-border-light p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Upload size={16} className="text-text-secondary" strokeWidth={1.5} />
                <p className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                  Documents (pièce jointe) — JPG, PNG ou PDF, max 10 Mo
                </p>
              </div>
              {activeTab === 'merchant' ? (
                <>
                  <KycFilePicker
                    field="identityCard"
                    label={KYC_LABELS.identityCard}
                    required
                    file={files.identityCard}
                    onChange={(file) => setFiles((f) => ({ ...f, identityCard: file }))}
                  />
                  <KycFilePicker
                    field="vehicleRegistration"
                    label={KYC_LABELS.vehicleRegistration}
                    file={files.vehicleRegistration}
                    onChange={(file) => setFiles((f) => ({ ...f, vehicleRegistration: file }))}
                  />
                </>
              ) : (
                <>
                  <KycFilePicker
                    field="driverLicense"
                    label={KYC_LABELS.driverLicense}
                    file={files.driverLicense}
                    onChange={(file) => setFiles((f) => ({ ...f, driverLicense: file }))}
                  />
                  <KycFilePicker
                    field="identityCard"
                    label={KYC_LABELS.identityCard}
                    file={files.identityCard}
                    onChange={(file) => setFiles((f) => ({ ...f, identityCard: file }))}
                  />
                  <KycFilePicker
                    field="vehicleRegistration"
                    label={KYC_LABELS.vehicleRegistration}
                    file={files.vehicleRegistration}
                    onChange={(file) => setFiles((f) => ({ ...f, vehicleRegistration: file }))}
                  />
                </>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs text-text-secondary mb-2">Mot de passe</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} />
              <input
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => set('password', e.target.value)}
                className={inputClass('password')}
              />
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-2">Confirmer le mot de passe</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} />
              <input
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => set('confirmPassword', e.target.value)}
                className={inputClass('confirmPassword')}
              />
            </div>
            {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-2">
              Code de parrainage <span className="text-text-muted">(facultatif)</span>
            </label>
            <div className="relative">
              <CreditCard size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Ex : AMARA-4F2B"
                value={formData.referralCode}
                onChange={(e) => set('referralCode', e.target.value)}
                className={inputClass('referralCode')}
              />
            </div>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-100 text-error px-4 py-3 rounded-lg text-sm">
              {submitError}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 text-sm font-medium text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: ACCENT }}
          >
            {loading
              ? 'Envoi en cours…'
              : activeTab === 'client'
                ? 'Créer mon compte client'
                : activeTab === 'merchant'
                  ? 'Envoyer ma candidature marchand'
                  : 'Envoyer ma candidature livreur'}
          </button>
        </form>

        {activeTab !== 'client' && (
          <div className="mt-4 flex items-start gap-2 text-xs text-text-secondary bg-background-secondary rounded-lg px-4 py-3">
            <Car size={14} className="mt-0.5 shrink-0" strokeWidth={1.5} />
            <p>
              Votre dossier est examiné par notre équipe avant activation du compte.
              Vous recevrez vos identifiants de connexion par SMS dès validation.
            </p>
          </div>
        )}

        {/* Login Link */}
        <div className="text-center mt-6">
          <p className="text-sm text-text-secondary">
            Vous avez déjà un compte ?{' '}
            <button
              onClick={() => navigate('/auth')}
              className="font-medium hover:underline"
              style={{ color: ACCENT }}
            >
              Se connecter
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

const KycFilePicker = ({ label, required, file, onChange, accept = 'image/*,.pdf' }) => {
  const id = `kyc-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <div>
      <label className="block text-xs text-text-secondary mb-2">
        {label} {required && <span className="text-error">*</span>}
      </label>
      <label
        htmlFor={id}
        className="flex items-center justify-center gap-2 w-full py-3 bg-background-secondary border-2 border-dashed border-border-medium hover:border-border-dark transition-colors cursor-pointer text-xs text-text-secondary"
      >
        <Upload size={15} strokeWidth={1.5} />
        <span className="truncate max-w-[70%]">
          {file ? file.name : 'Cliquez pour choisir un fichier'}
        </span>
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
    </div>
  );
};

export default Register;
