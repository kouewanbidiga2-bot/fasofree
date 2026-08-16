/**
 * FasoFree — Service KYC (Validation des comptes commerçants & livreurs)
 * Endpoints: /kyc/admin
 */
import api from './api';

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
