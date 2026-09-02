import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import bannerBg from '../assets/banner-bg.jpg';

export default function HeroBanner() {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#F0E6D6]">
      {/* ── Sun: pure CSS, no SVG ── */}
      <div className="hero-sun" aria-hidden="true" />

      <div className="relative grid grid-cols-[1fr_auto] items-stretch min-h-[240px] sm:min-h-[300px]">
        {/* Left: text */}
        <div className="relative z-10 flex flex-col justify-center px-5 py-8 sm:px-8 sm:py-12">
          <div
            className="flex items-center gap-2 mb-4"
            style={{
              opacity: loaded ? 1 : 0,
              transform: loaded ? 'none' : 'translateX(-12px)',
              transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-[#C1652E] hero-sun-pulse" />
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#9A7D5A]">
              Ouagadougou
            </span>
          </div>

          <h1
            className="text-[28px] sm:text-[36px] lg:text-[44px] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#29231E]"
            style={{
              opacity: loaded ? 1 : 0,
              transform: loaded ? 'none' : 'translateY(16px)',
              transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s',
            }}
          >
            Le bon repas,
            <br />
            au{' '}
            <span className="relative text-[#C1652E]">
              bon moment
              <svg
                className="absolute -bottom-1 left-0 w-full h-[6px]"
                viewBox="0 0 200 6"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 4C50 1.5 100 2 150 3C175 3.5 195 2.5 198 3"
                  stroke="#C1652E"
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: 200,
                    strokeDashoffset: loaded ? 0 : 200,
                    transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1) 0.4s',
                  }}
                />
              </svg>
            </span>
          </h1>

          <p
            className="mt-4 text-[13px] sm:text-sm text-[#6B5A48] max-w-[280px] leading-relaxed"
            style={{
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.5s ease 0.3s',
            }}
          >
            Vos restaurants préférés, livrés chauds chez vous.
          </p>

          {/* ── Button: solid, tactile, reflection built-in ── */}
          <div
            className="mt-6"
            style={{
              opacity: loaded ? 1 : 0,
              transform: loaded ? 'none' : 'translateY(12px)',
              transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.5s',
            }}
          >
            <a
              href="#restaurants"
              className="hero-btn inline-flex items-center gap-3 bg-[#29231E] pl-6 pr-2 py-2 rounded-xl text-[11px] font-bold uppercase tracking-[0.12em] text-[#FAF5EE] active:scale-[0.97]"
            >
              Commander
              <span className="grid place-items-center w-9 h-9 rounded-lg bg-[#C1652E] text-white hero-btn-arrow">
                <ArrowRight size={15} />
              </span>
            </a>

            <div className="flex items-center gap-2 mt-4 text-[11px] font-bold text-[#8B7355]">
              <MapPin size={12} className="text-[#C1652E]" />
              25–40 min
            </div>
          </div>
        </div>

        {/* Right: food image */}
        <div
          className="relative w-[140px] sm:w-[200px] lg:w-[260px] self-stretch overflow-hidden"
          style={{
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.6s ease 0.15s',
          }}
        >
          <img
            ref={imgRef}
            src={bannerBg}
            alt="Plat FasoFree"
            className="absolute inset-0 w-full h-full object-cover"
            onLoad={() => setLoaded(true)}
          />
          {/* Fade left edge into background */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#F0E6D6] via-transparent to-transparent w-10" />
          {/* Subtle warm tint */}
          <div className="absolute inset-0 bg-[#C1652E]/5 mix-blend-multiply" />
        </div>
      </div>
    </section>
  );
}
