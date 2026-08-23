import React from 'react';
import { ArrowRight, Clock3, MapPin } from 'lucide-react';
import bannerBg from '../assets/banner-bg.jpg';

export default function HeroBanner() {
  return (
    <section className="home-hero relative isolate overflow-hidden shadow-medium rounded-2xl bg-gradient-to-br from-[#f3ead9] via-[#e6d5ba] to-[#c2a075]">
      {/* Texture du site pour fondre le banner dans le design global */}
      <div className="absolute inset-0 bg-texture opacity-30 pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/60" />

      <div className="relative grid sm:grid-cols-[1.1fr_0.9fr] items-center gap-6 px-5 py-6 sm:gap-8 sm:px-10 sm:py-12 lg:px-14">
        {/* Colonne texte */}
        <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
          <h1 className="hero-reveal hero-reveal-1 mt-1 font-serif text-[30px] sm:text-5xl lg:text-[56px] font-medium leading-[1.04] tracking-[-0.01em] text-[#29231e] max-w-xl">
            Le bon repas, au{' '}
            <em className="italic text-[#a34a24]">bon moment</em>.
          </h1>

          <p className="hero-reveal hero-reveal-2 mt-2.5 sm:mt-4 text-sm sm:text-[15px] text-[#6b5a48] max-w-md font-medium">
            Vos restaurants préférés, livrés chauds chez vous en un rien de temps.
          </p>

          <div className="hero-reveal hero-reveal-3 mt-5 sm:mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-center sm:justify-start gap-2.5 sm:gap-3 w-full">
            {/* Bouton éditorial : bloc brun + flèche terracotta — pleine largeur sur mobile */}
            <a
              href="#restaurants"
              className="group inline-flex items-center justify-center sm:justify-start gap-4 bg-[#29231e] pl-6 pr-1.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-[0.14em] text-[#faf5ee] transition-all duration-200 hover:bg-[#1e1813] active:scale-[0.97] w-full sm:w-auto"
            >
              Commander
              <span className="grid place-items-center w-9 h-9 rounded-lg bg-[#C1652E] text-white transition-transform duration-200 group-hover:translate-x-1">
                <ArrowRight size={15} aria-hidden="true" />
              </span>
            </a>
            {/* Chips brun de l'app, côte à côte sous le bouton sur mobile */}
            <div className="flex items-stretch sm:items-center gap-2.5 sm:gap-3">
              <div className="hero-reveal hero-reveal-4 flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 bg-[#29231e] px-4 py-2.5 rounded-lg text-xs font-bold text-[#faf5ee] whitespace-nowrap">
                <MapPin size={13} className="text-[#e8a379]" aria-hidden="true" />
                Ouagadougou
              </div>
              <div className="hero-reveal hero-reveal-5 flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 bg-[#29231e] px-4 py-2.5 rounded-lg text-xs font-bold text-[#faf5ee] whitespace-nowrap">
                <Clock3 size={13} className="text-[#e8a379]" aria-hidden="true" />
                25–40 min
              </div>
            </div>
          </div>
        </div>

        {/* Image en arche : slide-in depuis la droite + flottement + zoom lent */}
        <div className="hero-slide-in justify-self-center sm:justify-self-end w-fit">
          <div className="hero-float relative">
            <div
              className="absolute -inset-3 rounded-t-full rounded-b-3xl border border-[#a8825a]/50 pointer-events-none motion-safe:rotate-2"
              aria-hidden="true"
            />
            <div className="relative w-44 sm:w-60 lg:w-72 aspect-[3/4] rounded-t-full rounded-b-2xl overflow-hidden ring-1 ring-[#29231e]/15 shadow-2xl shadow-[#5c4327]/30">
              <img
                src={bannerBg}
                alt="Cuisine FasoFree"
                className="hero-kenburns w-full h-full object-cover"
              />
              {/* Voiles chauds beige/marron pour fondre l'image dans la palette */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#7a5230]/45 via-transparent to-[#f3ead9]/25 mix-blend-multiply" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#3a2a1c]/35 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
