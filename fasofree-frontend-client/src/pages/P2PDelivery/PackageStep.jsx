/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

const DIMENSIONS = [
  { key: 'length', label: 'Longueur (cm)', placeholder: '30' },
  { key: 'width', label: 'Largeur (cm)', placeholder: '20' },
  { key: 'height', label: 'Hauteur (cm)', placeholder: '15' },
];

export default function PackageStep({ value, onUpdate }) {
  return (
    <section className="app-panel p2p-location p2p-package" aria-labelledby="p2p-package-title">
      <h2 id="p2p-package-title">Votre colis</h2>
      <div className="p2p-fields">
        <label>
          <span>Description</span>
          <textarea
            placeholder="Ex. Documents dans une enveloppe"
            value={value.description}
            onChange={(event) => onUpdate('description', event.target.value)}
            required
            rows={2}
            className="app-input resize-y"
          />
        </label>
        <div className="p2p-package-measures">
          <label>
            <span>Valeur déclarée (F CFA)</span>
            <input type="number" min="0" placeholder="Ex. 3 000" value={value.estimatedAmount} onChange={(event) => onUpdate('estimatedAmount', event.target.value)} required className="app-input" />
          </label>
          <label>
            <span>Poids en kg (facultatif)</span>
            <input type="number" min="0" step="0.1" placeholder="Ex. 2" value={value.weight} onChange={(event) => onUpdate('weight', event.target.value)} className="app-input" />
          </label>
        </div>
        <label className="p2p-fragile">
          <input type="checkbox" checked={value.isFragile} onChange={(event) => onUpdate('isFragile', event.target.checked)} />
          <span>Colis fragile</span>
        </label>
        <details className="p2p-dimensions" open={DIMENSIONS.some(({ key }) => value[key]) || undefined}>
          <summary>Dimensions (facultatif)</summary>
          <div className="p2p-package-measures">
            {DIMENSIONS.map(({ key, label, placeholder }) => (
              <label key={key}>
                <span>{label}</span>
                <input type="number" min="0" placeholder={placeholder} value={value[key]} onChange={(event) => onUpdate(key, event.target.value)} className="app-input" />
              </label>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}
