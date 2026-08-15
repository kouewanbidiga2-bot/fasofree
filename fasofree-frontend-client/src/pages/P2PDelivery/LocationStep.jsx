import React from 'react';
import { MapPin, LocateFixed } from 'lucide-react';

const LocationStep = ({
  title,
  contactLabel,
  phoneLabel,
  value,
  onUpdate,
  onUseCurrentLocation,
}) => (
  <div className="app-panel rounded-lg p-5 mb-6 fade-in">
    <h2 className="text-sm font-medium text-text-secondary mb-6 flex items-center gap-2">
      <MapPin size={16} className="text-accent-primary" strokeWidth={1.5} />
      {title}
    </h2>

    <button
      type="button"
      className="app-action-secondary w-full mb-4 gap-2"
      onClick={onUseCurrentLocation}
    >
      <LocateFixed size={16} /> Utiliser ma position actuelle
    </button>

    <div className="mb-4">
      <label className="block text-xs text-text-secondary mb-2">Adresse complète *</label>
      <input
        type="text"
        placeholder="Quartier, rue, numéro..."
        value={value.address}
        onChange={(e) => onUpdate('address', e.target.value)}
        required
        className="app-input"
      />
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
      <div>
        <label className="block text-xs text-text-secondary mb-2">{contactLabel} *</label>
        <input
          type="text"
          placeholder={contactLabel === 'Nom du contact' ? 'Qui récupère le colis ?' : 'Qui reçoit le colis ?'}
          value={value.contactName}
          onChange={(e) => onUpdate('contactName', e.target.value)}
          required
          className="app-input"
        />
      </div>
      <div>
        <label className="block text-xs text-text-secondary mb-2">{phoneLabel} *</label>
        <input
          type="tel"
          placeholder="+226 XX XX XX XX"
          value={value.contactPhone}
          onChange={(e) => onUpdate('contactPhone', e.target.value)}
          required
          className="app-input"
        />
      </div>
    </div>

    <div className="mb-4">
      <label className="block text-xs text-text-secondary mb-2">Instructions (optionnel)</label>
      <input
        type="text"
        placeholder="Ex: Sonnette, code d'accès..."
        value={value.instructions}
        onChange={(e) => onUpdate('instructions', e.target.value)}
        className="app-input"
      />
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs text-text-secondary mb-2">Latitude</label>
        <input
          type="number"
          step="any"
          value={value.latitude}
          onChange={(e) => onUpdate('latitude', e.target.value)}
          className="app-input"
        />
      </div>
      <div>
        <label className="block text-xs text-text-secondary mb-2">Longitude</label>
        <input
          type="number"
          step="any"
          value={value.longitude}
          onChange={(e) => onUpdate('longitude', e.target.value)}
          className="app-input"
        />
      </div>
    </div>
  </div>
);

export default LocationStep;
