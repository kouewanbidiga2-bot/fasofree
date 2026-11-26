/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

/**
 * Koliwa Coursier — contrat du livreur (signature par code OTP).
 */
import api from './api';

export const fetchContractStatus = async () => {
  const { data } = await api.get('/legal/contracts/pending');
  return data ?? {};
};

export const fetchLegalDocument = async (docCode) => {
  const { data } = await api.get(`/legal/documents/${encodeURIComponent(docCode)}`);
  return data;
};

export const requestContractOtp = async () => {
  const { data } = await api.post('/legal/contracts/send-otp');
  return data;
};

export const signContract = async (code) => {
  const { data } = await api.post('/legal/contracts/sign', { code });
  return data;
};
