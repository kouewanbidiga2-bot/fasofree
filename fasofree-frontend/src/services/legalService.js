/**
 * FasoFree — Service pack légal (dashboard marchand/livreur)
 * Signature de contrat : OTP + enregistrement côté backend.
 */
import api from './api';

/**
 * État du contrat à signer pour le compte connecté.
 * Retour : { pending: boolean, contract: { docCode, docVersion, title } | null }
 */
export const getContractStatus = async () => {
  const response = await api.get('/legal/contracts/pending');
  return response.data;
};

/** Document légal complet (contenu markdown, version, date…). */
export const getLegalDocument = async (docCode) => {
  const response = await api.get(`/legal/documents/${encodeURIComponent(docCode)}`);
  return response.data;
};

/** Envoie le code OTP de signature (cooldown 60 s géré par le backend). */
export const sendContractOtp = async () => {
  const response = await api.post('/legal/contracts/send-otp');
  return response.data;
};

/** Vérifie le code et signe le contrat (mécanisme signature-otp). */
export const signContract = async (code) => {
  const response = await api.post('/legal/contracts/sign', { code });
  return response.data;
};