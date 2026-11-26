import React from 'react';
import { useSearchParams } from 'react-router-dom';
import SuccessScreen from './SuccessScreen';

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const orderRef = params.get('orderId');
  const trackingToken = params.get('trackingToken');
  const trackingReference = params.get('reference');

  function startNewDelivery() {
    try {
      const key = `koliwa_checkout_${orderRef}`;
      const draftKey = sessionStorage.getItem(key);
      if (['fasofree_p2p_draft_parcel', 'fasofree_p2p_draft_merchant-pickup'].includes(draftKey)) {
        sessionStorage.removeItem(draftKey);
        sessionStorage.removeItem(key);
      }
    } catch {
      /* Le nouveau formulaire reste accessible. */
    }
    window.location.href = '/p2p-delivery';
  }

  return <SuccessScreen orderRef={orderRef || '—'} trackingToken={trackingToken} trackingReference={trackingReference} onReset={startNewDelivery} />;
}
