import { useId, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { KoliwaMark } from '../components/KoliwaLogo';

function returnHome() {
  if (!navigator.onLine) return false;
  window.location.replace('/');
  return true;
}

export default function Offline({ onRetry = returnHome, titleId = 'offline-title' }) {
  const messageId = useId();
  const [retryFailed, setRetryFailed] = useState(false);

  return (
    <section className="app-state-screen offline-screen" aria-labelledby={titleId}>
      <div className="app-state-brand"><KoliwaMark size={40} /></div>
      <div className="app-state-content">
        <div className="app-state-symbol"><WifiOff size={36} strokeWidth={1.5} aria-hidden="true" /></div>
        <h1 id={titleId}>Pas de connexion</h1>
        <p id={messageId}>Vérifiez le Wi-Fi ou les données mobiles. Vous pourrez reprendre dès que la connexion revient.</p>
        <button type="button" className="app-state-retry" aria-describedby={messageId} onClick={() => setRetryFailed(!onRetry())}>
          <RefreshCw size={17} strokeWidth={1.8} aria-hidden="true" />
          Réessayer
        </button>
        <p className="app-state-feedback" role="status">{retryFailed ? 'Toujours hors connexion.' : ''}</p>
      </div>
    </section>
  );
}
