/**
 * FasoFree — Service KYC (Validation des comptes commerçants & livreurs)
 * Endpoints: /kyc/admin
 */
import api from './api';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.fasofree.site/api/v1';
const API_ORIGIN = API_URL.replace(/\/+$/, '').replace(/\/api\/v1$/i, '');

/** Résout une URL relative (/uploads/...) contre l'origine de l'API */
export const resolveFileUrl = (u) => {
  if (!u) return null;
  if (u.startsWith('http')) return u;
  if (u.startsWith('/')) return `${API_ORIGIN}${u}`;
  return `${API_ORIGIN}/${u}`;
};

/** File d'attente des documents KYC en attente (SUPER_ADMIN, ADMIN, SUPPORT) */
export const getKycPending = async () => {
  const response = await api.get('/kyc/admin/pending');
  return response.data;
};

/** Approuver un document KYC */
export const approveKyc = async (id) => {
  const response = await api.post(`/kyc/admin/${id}/approve`);
  return response.data;
};

/** Rejeter un document KYC (le motif est obligatoire) */
export const rejectKyc = async (id, reason) => {
  const response = await api.post(`/kyc/admin/${id}/reject`, { reason });
  return response.data;
};

/** URL consultable d'un document KYC (admin/support ou propriétaire) */
export const getKycDocumentUrl = async (id) => {
  const response = await api.get(`/kyc/documents/${id}/url`);
  return resolveFileUrl(response.data.url);
};
