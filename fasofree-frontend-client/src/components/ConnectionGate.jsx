import { useCallback, useEffect, useRef, useState } from 'react';
import Offline from '../pages/Offline';

function OfflineDialog({ onRetry }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog ref={dialogRef} className="connection-dialog" aria-labelledby="offline-dialog-title" onCancel={(event) => event.preventDefault()}>
      <Offline onRetry={onRetry} titleId="offline-dialog-title" />
    </dialog>
  );
}

export default function ConnectionGate({ children }) {
  const [online, setOnline] = useState(() => navigator.onLine);

  const updateConnection = useCallback(() => {
    const connected = navigator.onLine;
    setOnline(connected);
    return connected;
  }, []);

  useEffect(() => {
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    updateConnection();
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, [updateConnection]);

  // Garder la page montée pour reprendre le formulaire et récupérer son état.
  return (
    <>
      {children}
      {!online && <OfflineDialog onRetry={updateConnection} />}
    </>
  );
}
