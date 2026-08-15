import React from 'react';
import { Package, Weight } from 'lucide-react';

const DIMENSIONS = [
  { key: 'length', label: 'Longueur (cm)', placeholder: '30' },
  { key: 'width', label: 'Largeur (cm)', placeholder: '20' },
  { key: 'height', label: 'Hauteur (cm)', placeholder: '15' },
];

const PackageStep = ({ value, onUpdate }) => (
  <div className="app-panel rounded-lg p-5 mb-6 fade-in">
    <h2 className="text-sm font-medium text-text-secondary mb-6 flex items-center gap-2">
      <Package size={16} className="text-accent-primary" strokeWidth={1.5} />
      Détails du colis
    </h2>

    <div className="mb-4">
      <label className="block text-xs text-text-secondary mb-2">Description du colis *</label>
      <textarea
        placeholder="Ex: Clés, documents, colis de 2 kg..."
        value={value.description}
        onChange={(e) => onUpdate('description', e.target.value)}
        required
        rows={3}
        className="app-input resize-none"
      />
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
      <div>
        <label className="block text-xs text-text-secondary mb-2 flex items-center gap-1.5">
          <Weight size={13} className="text-text-tertiary" /> Poids estimé (kg)
        </label>
        <input
          type="number"
          min="0"
          step="0.1"
          placeholder="Ex: 2"
          value={value.weight}
          onChange={(e) => onUpdate('weight', e.target.value)}
          className="app-input"
        />
      </div>
      <div>
        <label className="block text-xs text-text-secondary mb-2">Montant estimé (FCFA) *</label>
        <input
          type="number"
          min="0"
          placeholder="Ex: 3000"
          value={value.estimatedAmount}
          onChange={(e) => onUpdate('estimatedAmount', e.target.value)}
          required
          className="app-input"
        />
      </div>
    </div>

    <label className="mb-6 flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={value.isFragile}
        onChange={(e) => onUpdate('isFragile', e.target.checked)}
        className="h-4 w-4 rounded border-border-light accent-[#B95B2B]"
      />
      <span className="text-sm text-text-secondary">Colis fragile</span>
    </label>

    <div className="grid grid-cols-3 gap-4">
      {DIMENSIONS.map((dim) => (
        <div key={dim.key}>
          <label className="block text-xs text-text-secondary mb-2">{dim.label}</label>
          <input
            type="number"
            min="0"
            placeholder={dim.placeholder}
            value={value[dim.key]}
            onChange={(e) => onUpdate(dim.key, e.target.value)}
            className="app-input"
          />
        </div>
      ))}
    </div>
  </div>
);

export default PackageStep;
