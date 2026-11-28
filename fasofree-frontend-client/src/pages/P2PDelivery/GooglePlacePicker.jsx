import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, hasGoogleMapsKey } from '../../services/googleMaps';

const CITY = { lat: 12.3714, lng: -1.5197 };

export default function GooglePlacePicker({ map, onSearch }) {
  const host = useRef(null);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const [error, setError] = useState('');

  useEffect(() => {
    if (!map) return;
    let active = true;
    let dispose;
    async function setup() {
      try {
        const maps = await loadGoogleMaps();
        const { PlaceAutocompleteElement } = await maps.importLibrary('places');
        if (!active) return;
        const widget = new PlaceAutocompleteElement({
          includedRegionCodes: ['bf'], locationBias: { center: CITY, radius: 30000 },
        });
        widget.setAttribute('aria-label', 'Rechercher un commerce ou un quartier');
        widget.style.width = '100%';
        let selection = 0;
        const select = async ({ placePrediction }) => {
          const request = ++selection;
          setError('');
          try {
            const place = placePrediction.toPlace();
            await place.fetchFields({ fields: ['location'] });
            if (!active || request !== selection) return;
            if (!place.location) throw new Error('Position indisponible');
            onSearchRef.current?.();
            map.setCenter(place.location);
            map.setZoom(18);
          } catch {
            if (active && request === selection) setError('Ce lieu ne peut pas être affiché. Essaie un autre résultat.');
          }
        };
        const fail = () => { if (active) setError('La recherche Google Maps est indisponible.'); };
        widget.addEventListener('gmp-select', select);
        widget.addEventListener('gmp-error', fail);
        host.current.append(widget);
        dispose = () => widget.remove();
      } catch {
        if (active) setError('La recherche Google Maps est indisponible.');
      }
    }
    void setup();
    return () => { active = false; dispose?.(); };
  }, [map]);

  if (!hasGoogleMapsKey) return null;
  return <div className="p2p-google-search"><div ref={host} />{error && <p role="status">{error}</p>}</div>;
}
