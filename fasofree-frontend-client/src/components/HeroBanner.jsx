import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Clock3, MapPin, ChevronDown } from 'lucide-react';
import bannerBg from '../assets/banner-bg.jpg';

const TITLE = 'FASOFREE';
const SUBTITLE_LETTERS = 'Vos plats favoris, livrés chauds.';

function StaggeredCharReveal({ text, className, delay = 0, speed = 60 }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setVisibleCount(i);
        if (i >= text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text.length, delay, speed]);

  return (
    <span className={className} aria-label={text}>
      {text.split('').map((char, idx) => (
        <span
          key={idx}
          className="inline-block transition-all duration-500"
          style={{
            opacity: idx < visibleCount ? 1 : 0,
            transform: idx < visibleCount ? 'translateY(0) rotateX(0)' : 'translateY(40%) rotateX(-40deg)',
            filter: idx < visibleCount ? 'blur(0)' : 'blur(4px)',
            transitionDelay: `${idx * 30}ms`,
          }}
          aria-hidden="true"
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
}

export default function HeroBanner() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleMouseMove = (e) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      className="hero-editorial relative isolate overflow-hidden rounded-2xl bg-[#1a1410]"
    >
      {/* Grain texture overlay */}
      <div className="hero-grain absolute inset-0 pointer-events-none z-30" />

      {/* Background image with parallax */}
      <div
        className="absolute inset-0 z-0 transition-transform duration-700 ease-out"
        style={{
          transform: `translate(${mousePos.x * -15}px, ${mousePos.y * -15}px) scale(1.15)`,
        }}
      >
        <img
          src={bannerBg}
          alt=""
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1410]/60 via-[#1a1410]/30 to-[#1a1410]/80" />
      </div>

      {/* Accent line */}
      <div
        className="absolute top-0 left-0 w-full h-[2px] z-20 origin-left"
        style={{
          background: 'linear-gradient(90deg, transparent, #C1652E, transparent)',
          animationDelay: '0.8s',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scaleX(1)' : 'scaleX(0)',
          transition: 'opacity 0.8s ease 0.8s, transform 1.2s cubic-bezier(0.23, 1, 0.32, 1) 0.8s',
        }}
      />

      <div className="relative z-10 px-5 sm:px-10 lg:px-16 py-10 sm:py-16 lg:py-20">
        {/* Oversized title */}
        <div className="hero-title-container relative">
          <h1
            className="hero-title text-[18vw] sm:text-[14vw] md:text-[11vw] lg:text-[120px] xl:text-[140px] font-black leading-[0.85] tracking-[-0.04em] text-transparent bg-clip-text select-none"
            style={{
              backgroundImage: `url(${bannerBg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
              transition: 'opacity 0.8s ease 0.2s, transform 0.8s cubic-bezier(0.23, 1, 0.32, 1) 0.2s',
            }}
          >
            <StaggeredCharReveal text={TITLE} delay={300} speed={80} />
          </h1>

          {/* Decorative dot */}
          <div
            className="absolute -right-2 sm:right-4 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-[#C1652E]"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(-50%) scale(1)' : 'translateY(-50%) scale(0)',
              transition: 'opacity 0.5s ease 1.2s, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 1.2s',
            }}
          />
        </div>

        {/* Subtitle line */}
        <div
          className="mt-5 sm:mt-6 lg:mt-8 flex items-center gap-3"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease 1s, transform 0.6s cubic-bezier(0.23, 1, 0.32, 1) 1s',
          }}
        >
          <div className="w-8 sm:w-12 h-px bg-[#C1652E]" />
          <p className="text-[13px] sm:text-sm text-[#e8a379]/80 font-medium tracking-wide">
            <StaggeredCharReveal text={SUBTITLE_LETTERS} delay={1000} speed={35} />
          </p>
        </div>

        {/* CTA Row */}
        <div
          className="mt-7 sm:mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease 1.4s, transform 0.6s cubic-bezier(0.23, 1, 0.32, 1) 1.4s',
          }}
        >
          <a
            href="#restaurants"
            className="hero-cta-editorial group inline-flex items-center gap-4 bg-[#C1652E] pl-6 pr-2 py-2 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-[0.14em] text-white transition-all duration-300 hover:bg-[#a8521f] hover:shadow-[0_0_30px_rgba(193,101,46,0.3)] active:scale-[0.97]"
          >
            Commander
            <span className="grid place-items-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white/15 text-white transition-all duration-300 group-hover:translate-x-1 group-hover:bg-white/25">
              <ArrowRight size={15} aria-hidden="true" />
            </span>
          </a>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-2.5 rounded-lg text-xs font-bold text-[#e8a379] whitespace-nowrap">
              <MapPin size={13} className="text-[#C1652E]" aria-hidden="true" />
              Ouagadougou
            </div>
            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-2.5 rounded-lg text-xs font-bold text-[#e8a379] whitespace-nowrap">
              <Clock3 size={13} className="text-[#C1652E]" aria-hidden="true" />
              25–40 min
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="mt-10 sm:mt-14 flex justify-center sm:justify-start"
          style={{
            opacity: isVisible ? 1 : 0,
            transition: 'opacity 0.6s ease 2s',
          }}
        >
          <div className="hero-scroll-indicator flex flex-col items-center gap-1 text-[#e8a379]/40">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Scroll</span>
            <ChevronDown size={14} className="animate-bounce" />
          </div>
        </div>
      </div>

      {/* Bottom accent */}
      <div
        className="absolute bottom-0 left-0 w-full h-px z-20"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(193,101,46,0.3), transparent)',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 1s ease 1.5s',
        }}
      />
    </section>
  );
}
