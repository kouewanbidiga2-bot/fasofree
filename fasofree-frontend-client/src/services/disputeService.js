import { api } from './api';

export const approveRefund = async (disputeId) => {
  try {
    // This would call a backend endpoint to approve refund
    return { success: true, message: 'Remboursement approuvé' };
  } catch (error) {
    console.error('Error approving refund:', error);
    throw error;
  }
};

export const rejectDispute = async (disputeId, reason) => {
  try {
    // This would call a backend endpoint to reject dispute
    return { success: true, message: 'Litige rejeté' };
  } catch (error) {
    console.error('Error rejecting dispute:', error);
    throw error;
  }
};

export const openDispute = async (orderId, disputeData) => {
  try {
    return await api.openDispute(orderId, disputeData);
  } catch (error) {
    console.error('Error opening dispute:', error);
    throw error;
  }
};

export const getDisputes = async (status = 'PENDING') => {
  try {
    // This would call a backend endpoint to get disputes
    return [];
  } catch (error) {
    console.error('Error fetching disputes:', error);
    throw error;
  }
};

export const getDisputeById = async (disputeId) => {
  try {
    // This would call a backend endpoint to get dispute details
    return {};
  } catch (error) {
    console.error('Error fetching dispute:', error);
    throw error;
  }
};
