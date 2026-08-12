import React from 'react';

const WaveLogo = ({ className }) => (
  <div className={`flex items-center justify-center ${className || ''}`}>
    <svg viewBox="0 0 120 40" className="w-full h-full">
      <rect fill="#00A651" width="120" height="40" rx="6" />
      <path d="M15 12 L25 28 L35 12" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="20" r="8" stroke="white" strokeWidth="2" fill="none" />
      <text x="70" y="25" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial, sans-serif">Wave</text>
    </svg>
  </div>
);

const OrangeMoneyLogo = ({ className }) => (
  <div className={`flex items-center justify-center ${className || ''}`}>
    <svg viewBox="0 0 120 40" className="w-full h-full">
      <rect fill="#FF7900" width="120" height="40" rx="6" />
      <rect x="10" y="10" width="20" height="20" fill="white" rx="2" />
      <text x="40" y="25" fill="white" fontSize="12" fontWeight="bold" fontFamily="Arial, sans-serif">Orange</text>
      <text x="40" y="38" fill="white" fontSize="10" fontWeight="normal" fontFamily="Arial, sans-serif">Money</text>
    </svg>
  </div>
);

const MoovMoneyLogo = ({ className }) => (
  <div className={`flex items-center justify-center ${className || ''}`}>
    <svg viewBox="0 0 120 40" className="w-full h-full">
      <rect fill="#E6007E" width="120" height="40" rx="6" />
      <path d="M15 20 Q25 10 35 20 Q25 30 15 20" fill="white" />
      <path d="M35 20 Q45 10 55 20 Q45 30 35 20" fill="white" opacity="0.7" />
      <text x="65" y="25" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial, sans-serif">Moov</text>
    </svg>
  </div>
);

const TelecelMoneyLogo = ({ className }) => (
  <div className={`flex items-center justify-center ${className || ''}`}>
    <svg viewBox="0 0 120 40" className="w-full h-full">
      <rect fill="#00AEEF" width="120" height="40" rx="6" />
      <polygon points="20,10 30,20 20,30 10,20" fill="white" />
      <polygon points="35,10 45,20 35,30 25,20" fill="white" opacity="0.6" />
      <text x="55" y="25" fill="white" fontSize="11" fontWeight="bold" fontFamily="Arial, sans-serif">Telecel</text>
    </svg>
  </div>
);

const VisaLogo = ({ className }) => (
  <div className={`flex items-center justify-center ${className || ''}`}>
    <svg viewBox="0 0 120 40" className="w-full h-full">
      <rect fill="#1A1F71" width="120" height="40" rx="6" />
      <text x="15" y="27" fill="white" fontSize="16" fontWeight="bold" fontFamily="Arial, sans-serif" fontStyle="italic">VISA</text>
    </svg>
  </div>
);

const MastercardLogo = ({ className }) => (
  <div className={`flex items-center justify-center ${className || ''}`}>
    <svg viewBox="0 0 120 40" className="w-full h-full">
      <rect fill="#000" width="120" height="40" rx="6" />
      <circle cx="35" cy="20" r="14" fill="#EB001B" />
      <circle cx="55" cy="20" r="14" fill="#F79E1B" />
      <circle cx="45" cy="20" r="14" fill="#FF5F00" />
      <text x="75" y="25" fill="white" fontSize="10" fontWeight="bold" fontFamily="Arial, sans-serif">Mastercard</text>
    </svg>
  </div>
);

export { WaveLogo, OrangeMoneyLogo, MoovMoneyLogo, TelecelMoneyLogo, VisaLogo, MastercardLogo };
