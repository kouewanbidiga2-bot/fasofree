import React from 'react';

export default function KoliwaHandoffBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[#41241C] px-3 py-1 text-xs font-bold text-[#FFF1DD]">
      <span className="h-3 w-3 shrink-0 bg-[#D5A453]" style={{ clipPath: 'polygon(49% 0, 82% 14%, 100% 44%, 43% 100%, 0 57%)' }} aria-hidden="true" />
      Remis
    </span>
  );
}
