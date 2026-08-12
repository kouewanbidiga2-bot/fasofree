/**
 * FasoFree — Service d'authentification
 * Endpoints: /auth/register, /auth/login
 */
import api from './api';

/**
 * Inscription d'un nouvel utilisateur
 * @param {Object} data - { fullName, email, phone, password, role }
 * @returns {Promise} Réponse du serveur
 */
export const register = async (data) => {
  const response = await api.post('/auth/register', {
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    password: data.password,
    role: data.role || 'client',
  });
  return response.data;
};

/**
 * Connexion avec email et mot de passe
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ access_token: string, user: object }>}
 */
export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

/**
 * Obtenir le profil de l'utilisateur connecté
 * @returns {Promise<object>} Profil utilisateur
 */
export const getMe = async () => {
  const response = await api.get('/users/me');
  return response.data;
};

/**
 * Lister tous les utilisateurs (super_admin seulement)
 * @returns {Promise<Array>}
 */
export const getAllUsers = async () => {
  const response = await api.get('/users');
  return response.data;
};
