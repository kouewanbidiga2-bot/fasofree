import React from 'react';
import waveLogo from '../assets/payment/wave.jpg';
import orangeMoneyLogo from '../assets/payment/orange-money.svg';
import moovMoneyLogo from '../assets/payment/moov-money.png';
import telecelMoneyLogo from '../assets/payment/telecel-money.png';
import visaLogo from '../assets/payment/visa.svg';
import mastercardLogo from '../assets/payment/mastercard.svg';

const paymentAssets = {
  wave: { src: waveLogo, alt: 'Wave' },
  orange: { src: orangeMoneyLogo, alt: 'Orange Money' },
  moov: { src: moovMoneyLogo, alt: 'Moov Money' },
  telecel: { src: telecelMoneyLogo, alt: 'Telecel Money' },
  visa: { src: visaLogo, alt: 'Visa' },
  mastercard: { src: mastercardLogo, alt: 'Mastercard' },
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
  { id: 'wave', name: 'Wave' },
  { id: 'orange', name: 'Orange Money' },
  { id: 'moov', name: 'Moov Money' },
  { id: 'telecel', name: 'Telecel Money' },
  { id: 'visa', name: 'Visa' },
  { id: 'mastercard', name: 'Mastercard' },
];
