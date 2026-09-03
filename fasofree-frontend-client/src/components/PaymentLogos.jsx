import React from 'react';
import orangeMoneyLogo from '../assets/payment/orange-money.svg';
import moovMoneyLogo from '../assets/payment/moov-money.png';
import waveLogo from '../assets/payment/wave.jpg';

const paymentAssets = {
  orange: { src: orangeMoneyLogo, alt: 'Orange Money' },
  moov: { src: moovMoneyLogo, alt: 'Moov Money' },
  wave: { src: waveLogo, alt: 'Wave' },
};

export const PaymentLogo = ({ method, className = '' }) => {
  const asset = paymentAssets[method];

  if (!asset) return null;

  return (
    <img
      src={asset.src}
      alt={asset.alt}
      className={`h-full w-full object-contain ${className}`}
      loading="lazy"
    />
  );
};

export const paymentMethods = [
  { id: 'orange', name: 'Orange Money' },
  { id: 'moov', name: 'Moov Money' },
  { id: 'wave', name: 'Wave' },
];
