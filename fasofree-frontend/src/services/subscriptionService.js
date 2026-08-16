/**
 * FasoFree — Service Abonnements (Super Admin)
 * Endpoints: /subscriptions + /businesses
 */
import api from './api';

/**
 * Catalogue des forfaits
 * @param {'CUSTOMER'|'MERCHANT'} [subjectType]
 */
export const getSubscriptionPlans = async (subjectType) => {
  const response = await api.get('/subscriptions/plans', {
    params: subjectType ? { subjectType } : {},
  });
  return response.data;
};

/** Créer un forfait (super admin) */
export const createSubscriptionPlan = async (data) => {
  const response = await api.post('/subscriptions/plans', data);
  return response.data;
};

/** Mettre à jour un forfait (super admin) */
export const updateSubscriptionPlan = async (code, data) => {
  const response = await api.patch(`/subscriptions/plans/${code}`, data);
  return response.data;
};

/** Liste des abonnements actifs (super admin) */
export const getSubscriptions = async () => {
  const response = await api.get('/subscriptions');
  return response.data;
};

/**
 * Assigner / renouveler un forfait
 * @param {{subjectType:'CUSTOMER'|'MERCHANT', subjectId:string, planCode:string, durationDays?:number, autoRenew?:boolean, renew?:boolean, debitWallet?:boolean}} data
 */
export const assignSubscription = async (data) => {
  const response = await api.post('/subscriptions/assign', data);
  return response.data;
};

/** Liste des commerces (super admin) */
export const getBusinesses = async () => {
  const response = await api.get('/businesses');
  return response.data;
};
