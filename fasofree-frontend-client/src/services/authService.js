import { api } from './api';

export const getAllUsers = async () => {
  try {
    // For now, return mock users data
    // This would call a backend endpoint when ready
    return [
      {
        id: '1',
        email: 'user1@example.com',
        firstName: 'Jean',
        lastName: 'Doe',
        role: 'CLIENT',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        email: 'merchant@example.com',
        firstName: 'Aminata',
        lastName: 'Kabore',
        role: 'BUSINESS_ADMIN',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: '3',
        email: 'driver@example.com',
        firstName: 'Issa',
        lastName: 'Zongo',
        role: 'DRIVER',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
      },
    ];
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const getUserById = async (userId) => {
  try {
    // This would call api.getProfile() or a specific user endpoint
    return await api.getProfile();
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
};

export const updateUser = async (userId, userData) => {
  try {
    // This would be a backend endpoint to update user
    return { success: true, message: 'User updated successfully' };
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

export const deleteUser = async (userId) => {
  try {
    // This would be a backend endpoint to delete user
    return { success: true, message: 'User deleted successfully' };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};
