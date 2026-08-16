/**
 * FasoFree — Service Gestion des Utilisateurs (Super Admin)
 * Endpoints: /users
 */
import api from './api';

/** Liste de tous les utilisateurs (SUPER_ADMIN uniquement) */
export const getUsers = async () => {
  const response = await api.get('/users');
  return response.data;
};

/**
 * Créer un compte avec un rôle donné (SUPER_ADMIN uniquement).
 * C'est l'unique moyen de créer des comptes ADMIN / SUPPORT / SUPER_ADMIN.
 * @param {{fullName:string, email:string, phone:string, password:string, role?:string}} data
 */
export const createUser = async (data) => {
  const response = await api.post('/users', data);
  return response.data;
};

/** Bannir (isActive=false) ou réactiver (isActive=true) un compte */
export const updateUserStatus = async (id, isActive) => {
  const response = await api.patch(`/users/${id}/status`, { isActive });
  return response.data;
};

/** Changer le rôle d'un utilisateur */
export const updateUserRole = async (id, role) => {
  const response = await api.patch(`/users/${id}/role`, { role });
  return response.data;
};
