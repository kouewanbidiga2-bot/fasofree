import { useId, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { normalizeTrackingReference } from '../utils/trackingReference';

export default function TrackingLookup() {
  const fieldId = useId();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const reference = normalizeTrackingReference(input);
    if (reference) {
      navigate('/suivre', { state: { reference }, replace: pathname === '/suivre' });
      return;
    }
    const previousId = input.trim();
    if (/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(previousId)) {
      navigate(`/order-tracking?orderId=${previousId}`);
      return;
    }
    setError('Saisissez le numéro de suivi Koliwa figurant sur votre livraison.');
  };

  return (
    <form className="tracking-lookup" onSubmit={submit}>
      <label htmlFor={fieldId}>Numéro de suivi</label>
      <div className="tracking-lookup-control">
        <div className="tracking-input-wrap">
          <Search size={17} aria-hidden="true" />
          <input id={fieldId} value={input} onChange={(event) => { setInput(event.target.value); setError(''); }} placeholder="Réf. KW-…" maxLength={40} autoComplete="off" spellCheck={false} required aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : undefined} />
        </div>
        <button type="submit">Suivre <ArrowRight size={16} aria-hidden="true" /></button>
      </div>
      {error && <p id={`${fieldId}-error`} role="alert">{error}</p>}
    </form>
  );
}
