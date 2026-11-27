/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Package, Store } from 'lucide-react';
import { DELIVERY_SERVICES } from '../components/DeliveryGlyph';
import DeliveryJourney from '../components/DeliveryJourney';
import Footer from '../components/Footer';
import TrackingLookup from '../components/TrackingLookup';
import HomeIllustration from '../components/HomeIllustration';
import './Home.css';

const [parcel, pickup] = DELIVERY_SERVICES;
const scenes = [
  {
    src: 'ouaga-heros-photo.webp',
    author: 'The black photographer', license: 'CC0 1.0',
    terms: 'https://creativecommons.org/publicdomain/zero/1.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Monument_aux_h%C3%A9ros_nationaux_-_Ouagadougou_-_2024.jpg',
    width: 820, height: 499,
    to: parcel.to,
    alt: 'Monument des Héros nationaux de Ouagadougou',
    pan: 'a',
  },
  {
    src: 'ouaga-cineastes-photo.webp',
    author: 'Rikyelle Momo Nguematio', license: 'CC BY-SA 4.0',
    terms: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Place_des_cin%C3%A9astes.jpg',
    width: 820, height: 868,
    to: pickup.to,
    alt: 'Place des Cinéastes à Ouagadougou',
    pan: 'b',
  },
  {
    src: 'ouaga-rood-woko-photo.webp',
    author: 'Sputniktilt', license: 'CC BY-SA 3.0',
    terms: 'https://creativecommons.org/licenses/by-sa/3.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Rood_Woko_Ouagadougou_2013b.jpg',
    width: 820, height: 461,
    to: '/suivre',
    alt: 'Marché Rood Woko au centre de Ouagadougou',
    pan: 'c',
  },
];
const marqueeWords = ['Réserver', 'Envoyer', 'Suivre', 'Recevoir'];

/** Colis lancé, avec ses lignes de vitesse : motif motion design du bandeau. */
function ParcelMark() {
  return (
    <svg className="kw-marquee-parcel" viewBox="0 0 28 24" aria-hidden="true" focusable="false">
      <path d="M6.6 7.6 14.6 4l8.8 3.9v8.7l-8.8 3.9-8-3.5z" />
      <path d="M6.6 7.6l8 3.5 8.8-3.2M14.6 11.1v9.4" fill="none" stroke="#f0f2ed" strokeWidth="1.3" strokeLinejoin="round" opacity=".8" />
      <path className="kw-parcel-speed" d="M0.8 9.6h4.2M1.6 12.6h3.4M0.8 15.6h4.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Parcours de livraison animé, en boucle, façon motion design vidéo. */
function MotionRoute() {
  const route = 'M6 34C54 34 66 12 118 12s62 26 112 26 42-16 84-16';
  return (
    <svg className="kw-route" viewBox="0 0 320 48" fill="none" aria-hidden="true" focusable="false">
      <path className="kw-route-base" d={route} />
      <path className="kw-route-trace" d={route} />
      <circle className="kw-route-pin" cx="6" cy="34" r="4.5" />
      <circle className="kw-route-pin kw-route-pin--end" cx="314" cy="22" r="6" />
      <path className="kw-route-comet" d={route} pathLength="100" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="app-page koliwa-home">
      <section className="kw-poster" aria-labelledby="home-title">
        <span className="kw-poster-glow" aria-hidden="true" />
        <div className="kw-poster-inner">
          <p className="kw-poster-location">À Ouaga</p>
          <h1 id="home-title">Koliwa</h1>
          <p className="kw-poster-tagline">Vos colis, de porte à porte.</p>
          <HomeIllustration />
          <Link className="kw-home-button kw-poster-action" to={parcel.to}>
            <MapPin size={24} aria-hidden="true" /> {parcel.title}
          </Link>
        </div>
      </section>

      <section className="kw-home-services" id="services-livraison" aria-labelledby="home-services-title">
        <h2 id="home-services-title" className="sr-only">Services Koliwa</h2>
        <div className="kw-marquee" aria-hidden="true">
          {[0, 1].map((run) => (
            <span key={run}>
              {marqueeWords.map((word) => (
                <span className="kw-marquee-item" key={word}>
                  {word}<ParcelMark />
                </span>
              ))}
            </span>
          ))}
        </div>
        <div className="kw-photo-strip">
          <div className="kw-photo-track">
            {[0, 1].map((run) => (
              <div className="kw-photo-run" key={run} aria-hidden={run === 1 ? 'true' : undefined}>
                {scenes.map(({ src, to, alt, pan, width, height }) => (
                  <Link className="kw-photo" data-pan={pan} key={src} to={to} tabIndex={run === 1 ? -1 : undefined}>
                    <img src={`/assets/${src}`} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
                  </Link>
                ))}
                <div className="kw-pickup-panel">
                  <h3>Votre achat,<br />à votre porte.</h3>
                  <div>
                    <p>Un coursier récupère votre achat déjà payé en boutique.</p>
                    <Link className="kw-home-button" to={pickup.to} tabIndex={run === 1 ? -1 : undefined}>
                      {pickup.title} <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <details className="kw-home-width kw-photo-credits">
          <summary>Crédits photo</summary>
          <ul>
            {scenes.map(({ source, author, license, terms, alt }) => (
              <li key={source}>
                <a href={source} target="_blank" rel="noreferrer">{alt} · {author}</a>
                {' · '}<a href={terms} target="_blank" rel="noreferrer">{license}</a>
              </li>
            ))}
          </ul>
          <p>Photos redimensionnées et recadrées à l’affichage.</p>
        </details>
      </section>

      <section id="suivi-accueil" className="kw-home-width kw-track" aria-labelledby="home-tracking-title" tabIndex={-1}>
        <div className="kw-track-pattern" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => {
            const Icon = index % 2 ? MapPin : Package;
            return <Icon key={index} strokeWidth={0.75} />;
          })}
        </div>
        <div className="kw-track-inner">
          <p className="kw-track-kicker">Suivi en direct</p>
          <MotionRoute />
          <h2 id="home-tracking-title">Où est votre colis&nbsp;?</h2>
          <TrackingLookup />
          <Link className="kw-track-history" to="/order-history">
            Mes livraisons <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div className="kw-home-width kw-story">
        <DeliveryJourney />
      </div>

      <section className="kw-home-width kw-partner" aria-labelledby="home-partner-title">
        <div>
          <h2 id="home-partner-title">Livrez vos commandes.</h2>
          <p>Confiez les livraisons de votre commerce à Koliwa.</p>
          <Link className="kw-home-button" to="/register?pro=1">
            Devenir partenaire <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <Store className="kw-partner-icon" strokeWidth={0.85} aria-hidden="true" />
      </section>
      <Footer />
    </div>
  );
}
