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
    <section className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #F0E6D6 0%, #E8D5BF 50%, #DFC8A8 100%)' }}>

      {/* ── Pattern overlay: African geometric motif ── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" aria-hidden="true">
        <defs>
          <pattern id="hero-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#C1652E" opacity="0.12" />
          </pattern>
          <pattern id="hero-lines" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="40" stroke="#B95B2B" strokeWidth="0.5" opacity="0.07" />
          </pattern>
          <pattern id="hero-zigzag" x="0" y="0" width="32" height="16" patternUnits="userSpaceOnUse">
            <polyline points="0,12 8,4 16,12 24,4 32,12" fill="none" stroke="#C1652E" strokeWidth="0.6" opacity="0.08" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-dots)" />
        <rect width="100%" height="100%" fill="url(#hero-lines)" />
        <rect width="100%" height="100%" fill="url(#hero-zigzag)" />
      </svg>

      {/* ── Decorative triangles ── */}
      <div className="hero-tri hero-tri-1" aria-hidden="true">
        <svg viewBox="0 0 60 60" fill="none"><polygon points="30,5 55,55 5,55" stroke="#C1652E" strokeWidth="1" opacity="0.15" /></svg>
      </div>
      <div className="hero-tri hero-tri-2" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none"><polygon points="20,3 37,37 3,37" stroke="#D4A05A" strokeWidth="0.8" opacity="0.12" /></svg>
      </div>
      <div className="hero-tri hero-tri-3" aria-hidden="true">
        <svg viewBox="0 0 50 50" fill="none"><circle cx="25" cy="25" r="18" stroke="#C1652E" strokeWidth="0.6" opacity="0.1" /><circle cx="25" cy="25" r="10" stroke="#D4A05A" strokeWidth="0.5" opacity="0.08" /></svg>
      </div>

      {/* ── Sun ── */}
      <div className="hero-sun-wrap" aria-hidden="true">
        <div className="hero-sun-core" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="hero-sun-ray" style={{ transform: `rotate(${i * 45}deg)` }} />
        ))}
      </div>

      <div className="relative grid grid-cols-[1fr_auto] items-stretch min-h-[170px] sm:min-h-[240px]">
        {/* Left: text */}
        <div className="relative z-10 flex flex-col justify-center px-4 py-5 sm:px-8 sm:py-10">
          <div
            className="flex items-center gap-2 mb-2"
            style={{
              opacity: loaded ? 1 : 0,
              transform: loaded ? 'none' : 'translateX(-12px)',
              transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <MapPin size={14} className="text-[#C1652E] flex-shrink-0" />
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#9A7D5A]">
              Livraison à · Zone du Bois
            </span>
          </div>

          <h1
            className="text-[22px] sm:text-[32px] lg:text-[44px] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#29231E]"
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
              <svg className="absolute -bottom-1 left-0 w-full h-[6px]" viewBox="0 0 200 6" fill="none" preserveAspectRatio="none">
                <path d="M2 4C50 1.5 100 2 150 3C175 3.5 195 2.5 198 3" stroke="#C1652E" strokeWidth="2" strokeLinecap="round"
                  style={{ strokeDasharray: 200, strokeDashoffset: loaded ? 0 : 200, transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1) 0.4s' }} />
              </svg>
            </span>
          </h1>

          <p
            className="mt-2 text-[12px] sm:text-sm text-[#6B5A48] max-w-[240px] leading-relaxed"
            style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.5s ease 0.3s' }}
          >
            Vos restaurants préférés, livrés chauds chez vous.
          </p>

          <div
            className="mt-4"
            style={{
              opacity: loaded ? 1 : 0,
              transform: loaded ? 'none' : 'translateY(12px)',
              transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.5s',
            }}
          >
            <a
              href="#restaurants"
              className="hero-btn inline-flex items-center gap-3 rounded-full bg-[#C1652E] px-6 py-3 text-[12px] font-bold uppercase tracking-[0.1em] text-white shadow-[0_4px_14px_rgba(193,101,46,0.35)]"
            >
              Commander
              <ArrowRight size={15} className="hero-btn-arrow" />
            </a>

            <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-[#8B7355]">
              <MapPin size={12} className="text-[#C1652E]" />
              25–40 min
            </div>
          </div>
        </div>

        {/* Right: food image */}
        <div
          className="relative w-[110px] sm:w-[200px] lg:w-[260px] self-stretch overflow-hidden"
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.6s ease 0.15s' }}
        >
          <img ref={imgRef} src={bannerBg} alt="Plat FasoFree"
            className="absolute inset-0 w-full h-full object-cover"
            onLoad={() => setLoaded(true)} />
          <div className="absolute inset-y-0 left-0 w-16 sm:w-24"
            style={{ background: 'linear-gradient(to right, #E8D5BF 0%, #E8D5BF 20%, rgba(232,213,191,0.5) 50%, transparent 100%)' }} />
        </div>
      </div>
    </section>
  );
}
