const key = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY?.trim();
let pending;

export const hasGoogleMapsKey = Boolean(key);

export function loadGoogleMaps() {
  if (!key) return Promise.reject(new Error('Clé Google Maps absente.'));
  if (pending) return pending;
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);

  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const callback = 'koliwaGoogleMapsReady';
    const previousFailure = window.gm_authFailure;
    const timer = window.setTimeout(fail, 12000);
    function fail() {
      window.clearTimeout(timer);
      script.remove();
      delete window[callback];
      window.gm_authFailure = previousFailure;
      reject(new Error('Google Maps indisponible.'));
      window.dispatchEvent(new Event('koliwa-maps-auth-failure'));
    }
    window.gm_authFailure = fail;
    window[callback] = () => {
      window.clearTimeout(timer);
      delete window[callback];
      resolve(window.google.maps);
    };
    const params = new URLSearchParams({
      key, callback, loading: 'async', v: 'weekly', language: 'fr', region: 'BF',
      auth_referrer_policy: 'origin',
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  }).catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
