import React from 'react';
import { ArrowRight, Clock3, MapPin } from 'lucide-react';
import bannerImage from '../assets/banner-bg.jpg';

export default function HeroBanner() {
  return (
    <section className="home-hero relative isolate overflow-hidden border-y border-stone-900/10 bg-[#f0c47a] shadow-medium">
      <div className="grid min-h-[440px] lg:grid-cols-[1.03fr_.97fr]">
        <div className="relative z-10 flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14">
          <div className="hero-reveal hero-reveal-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#75351a]">
            FasoFree · Ouagadougou
          </div>
          <h1 className="hero-reveal hero-reveal-2 mt-7 max-w-xl text-balance font-display text-[clamp(3rem,6vw,5.9rem)] font-semibold leading-[.86] tracking-[-0.065em] text-[#29231e]">
            Le bon repas, au bon moment.
          </h1>
          <p className="hero-reveal hero-reveal-3 mt-7 max-w-md text-pretty text-base leading-7 text-[#553d30] sm:text-lg">
            Les meilleures cuisines de la ville, choisies pour vous et livrées avec attention.
          </p>
          <div className="hero-reveal hero-reveal-4 mt-8 flex flex-wrap items-center gap-5">
            <a href="#restaurants" className="hero-cta inline-flex items-center gap-2 bg-[#29231e] px-5 py-3.5 text-sm font-bold text-white">
              Découvrir les adresses <ArrowRight size={17} aria-hidden="true" />
            </a>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#553d30]"><Clock3 size={16} aria-hidden="true" /> 25–40 min en moyenne</span>
          </div>
        </div>
        <div className="hero-image-shell relative min-h-[300px] overflow-hidden lg:min-h-0">
          <img src={bannerImage} alt="Repas prêts à être livrés à Ouagadougou" className="hero-image absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/25 via-transparent to-transparent" />
          <div className="hero-location absolute bottom-5 left-5 inline-flex items-center gap-2 bg-[#fffaf2] px-3 py-2 text-xs font-bold text-[#29231e] shadow-subtle">
            <MapPin size={15} className="text-accent-primary" aria-hidden="true" /> Livraison locale
          </div>
        </div>
      </div>
    </section>
  );
}
