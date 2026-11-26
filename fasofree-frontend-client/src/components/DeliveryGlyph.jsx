export const DELIVERY_SERVICES = [
  { kind: 'parcel', title: 'Envoyer un colis', to: '/p2p-delivery' },
  { kind: 'pickup', title: 'Faire récupérer', to: '/p2p-delivery?mode=merchant-pickup' },
];

const artwork = {
  parcel: (
    <>
      <path className="glyph-base" d="M5.5 13.5 27 5l-8.5 21.5-4.4-8.6-8.6-4.4Z" />
      <path d="M14.1 17.9 27 5M5 22h4M5.5 26h7" />
    </>
  ),
  pickup: (
    <>
      <path className="glyph-base" d="M6.5 13v13H25V13" />
      <path className="glyph-side" d="M10 17.5h5v4.5h-5Z" />
      <path className="glyph-accent" d="M3.5 12.5 7 6h18l3.5 6.5V14a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0Z" />
      <path d="m9 12.5 1.6-6.4m5.4 0v6.4m7 0-1.6-6.4M19 26v-6.5h3.4M4 26h23" />
    </>
  ),
  track: (
    <>
      <path d="M6 25h11a3.5 3.5 0 0 0 0-7H8.5a3 3 0 0 1 0-6H12" strokeDasharray="2 2.7" />
      <circle className="glyph-base" cx="5.5" cy="25" r="2.2" />
      <path className="glyph-accent" d="M28 11c0 4.2-6.2 9.7-6.2 9.7S15.5 15.2 15.5 11a6.25 6.25 0 0 1 12.5 0Z" />
      <circle className="glyph-side" cx="21.75" cy="11" r="2" />
    </>
  ),

  home: (
    <>
      <path className="glyph-base" d="m5.5 13 10.5-8 10.5 8v12a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 25Z" />
      <path d="m3.5 14.5 11.3-8.7a2 2 0 0 1 2.4 0l11.3 8.7" />
      <path className="glyph-accent" d="M13 26.5V19a3 3 0 0 1 6 0v7.5Z" />
    </>
  ),
  history: (
    <>
      <rect className="glyph-accent" x="9" y="4.5" width="16.5" height="20" rx="2.3" />
      <rect className="glyph-base" x="5.5" y="7.8" width="16.5" height="20" rx="2.3" />
      <path d="M9.8 13h8m-8 4h5m-4.8 5 1.7 1.6 3.9-4" />
    </>
  ),
  profile: (
    <>
      <circle className="glyph-accent" cx="16" cy="11" r="5" />
      <path className="glyph-base" d="M6 25a10 7.5 0 0 1 20 0v1.5H6Z" />
      <path d="M12 20.3a8.4 8.4 0 0 1 8 0" />
    </>
  ),
  location: (
    <>
      <path d="M16 28S7.7 20.1 7.7 13.5a8.3 8.3 0 1 1 16.6 0C24.3 20.1 16 28 16 28Z" />
      <circle className="glyph-accent" cx="16" cy="13.5" r="2.7" />
    </>
  ),
  help: (
    <>
      <path d="M5.5 17.5v-2a10.5 10.5 0 0 1 21 0v3.3a6.5 6.5 0 0 1-6.5 6.5H17" />
      <rect className="glyph-base" x="5" y="14.5" width="5.5" height="8" rx="2" />
      <rect className="glyph-base" x="21.5" y="14.5" width="5.5" height="8" rx="2" />
      <path d="M14.5 25.3H17" />
    </>
  ),
  notifications: (
    <>
      <path d="M14 26a2 2 0 0 0 4 0" />
      <path className="glyph-base" d="M8.5 13a7.5 7.5 0 1 1 15 0v3.3c0 2.3.8 4 2 5.2a.9.9 0 0 1-.7 1.5H7.2a.9.9 0 0 1-.7-1.5c1.2-1.2 2-2.9 2-5.2Z" />
      <path d="M16 5.5V4" />
    </>
  ),
};

export default function DeliveryGlyph({ kind, className = '' }) {
  return (
    <svg className={`delivery-glyph ${className}`} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" focusable="false">
      {artwork[kind]}
    </svg>
  );
}
