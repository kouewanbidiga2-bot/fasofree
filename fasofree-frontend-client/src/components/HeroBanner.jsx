import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Clock3, MapPin } from 'lucide-react';
import bannerBg from '../assets/banner-bg.jpg';

export default function HeroBanner() {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true);
    }
  }, []);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#F0E6D6]">
      <div className="relative grid grid-cols-[1fr_auto] items-stretch min-h-[220px] sm:min-h-[280px]">
        {/* Left: text block */}
        <div className="relative z-10 flex flex-col justify-center px-5 py-8 sm:px-8 sm:py-10">
          {/* Tiny label */}
          <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#9A7D5A] mb-3">
            Ouagadougou
          </span>

          {/* Main headline — raw, no effects */}
          <h1
            className="text-[28px] sm:text-[36px] lg:text-[42px] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#29231E]"
            style={{
              opacity: loaded ? 1 : 0,
              transform: loaded ? 'none' : 'translateY(8px)',
              transition: 'opacity 0.4s ease, transform 0.4s ease',
            }}
          >
            Le bon repas,
            <br />
            au{' '}
            <span className="relative inline-block">
              bon moment
              {/* underline accent — hand-drawn feel */}
              <svg
                className="absolute -bottom-1 left-0 w-full h-2"
                viewBox="0 0 200 8"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M1 5.5C40 2, 80 1, 120 3C160 5, 190 4, 199 3"
                  stroke="#C1652E"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: 200,
                    strokeDashoffset: loaded ? 0 : 200,
                    transition: 'stroke-dashoffset 0.8s ease 0.3s',
                  }}
                />
              </svg>
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="mt-3 text-[13px] sm:text-sm text-[#6B5A48] max-w-[280px] leading-relaxed"
            style={{
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.5s ease 0.2s',
            }}
          >
            Vos restaurants préférés, livrés chauds chez vous.
          </p>

          {/* CTA */}
          <div
            className="mt-5 flex items-center gap-3"
            style={{
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.5s ease 0.35s',
            }}
          >
            <a
              href="#restaurants"
              className="inline-flex items-center gap-3 bg-[#29231E] pl-5 pr-1.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.12em] text-[#FAF5EE] transition-colors duration-150 hover:bg-[#1a150f] active:scale-[0.97]"
            >
              Commander
              <span className="grid place-items-center w-8 h-8 rounded-md bg-[#C1652E] text-white">
                <ArrowRight size={14} />
              </span>
            </a>

            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8B7355]">
              <MapPin size={12} className="text-[#C1652E]" />
              25–40 min
            </div>
          </div>
        </div>

        {/* Right: food image — no effects, just the photo */}
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
          {/* Fade edge into background */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#F0E6D6] via-transparent to-transparent w-8" />
        </div>
      </div>
    </section>
  );
}
