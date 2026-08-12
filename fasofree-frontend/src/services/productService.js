/**
 * FasoFree — Service Produits
 * Endpoints: /products
 */
import api from './api';

/**
 * Lister tous les produits d'un commerce
 * @param {string} businessId
 */
export const getProductsByBusiness = async (businessId) => {
  const response = await api.get(`/products/business/${businessId}`);
  return response.data;
};

/**
 * Ajouter un produit (business_admin)
 * @param {Object} data - { name, description, price, imageUrl, category, isAvailable, businessId }
 */
export const createProduct = async (data) => {
  const response = await api.post('/products', data);
  return response.data;
};

/**
 * Modifier un produit (business_admin)
 * @param {string} id
 * @param {Object} data - Champs à modifier
 */
export const updateProduct = async (id, data) => {
  const response = await api.patch(`/products/${id}`, data);
  return response.data;
};

/**
 * Supprimer un produit (business_admin)
 * @param {string} id
 */
export const deleteProduct = async (id) => {
  const response = await api.delete(`/products/${id}`);
  return response.data;
};

/**
 * Activer/Désactiver la disponibilité d'un produit
 * @param {string} id
 */
export const toggleProductAvailability = async (id) => {
  const response = await api.patch(`/products/${id}/toggle-availability`);
  return response.data;
};
