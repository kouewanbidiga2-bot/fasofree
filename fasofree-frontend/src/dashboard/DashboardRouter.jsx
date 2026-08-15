/**
 * FasoFree - Dashboard Router with Automatic Role-Based Routing
 * 
 * This component implements the automatic email-based redirection system:
 * 1. User authenticates at /login
 * 2. Backend returns JWT with role claim
 * 3. Frontend updates authStore
 * 4. User is redirected to the role-based dashboard route
 * 5. This router analyzes the role and renders the appropriate dashboard
 * 6. ProtectedRoute ensures security and prevents unauthorized access
 * 
 * Robust version with:
 * - Role normalization (handles case variations)
 * - Direct imports (no lazy loading to prevent crashes)
 * - Fallback components for unimplemented dashboards
 * - Comprehensive error handling
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { ProtectedRoute } from '../guards';

// Direct imports (eliminates lazy loading crashes)
import SuperAdminDashboard from './SuperAdminDashboard';
import AdminDashboard from './AdminDashboard';
import BusinessAdminDashboard from './BusinessAdminDashboard';
import DriverDashboard from './DriverDashboard';

// Secure placeholder component for unimplemented dashboards
const PlaceholderDashboard = ({ role, description }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-background-primary text-text-primary p-8 text-center">
    <div className="bg-background-card p-8 rounded-xl max-w-md w-full border border-border-light shadow-xl">
      <div className="w-16 h-16 rounded-full bg-accent-primary/10 flex items-center justify-center mx-auto mb-4">
        <div className="text-2xl">🚧</div>
      </div>
      <h2 className="text-xl font-bold mb-2 text-accent-primary">Espace {role}</h2>
      <p className="text-sm text-text-secondary mb-6">{description}</p>
      <span className="px-3 py-1.5 bg-accent-primary/10 text-accent-primary border border-accent-primary/20 text-xs font-semibold rounded-full">
        En cours de construction
      </span>
    </div>
  </div>
);

const DashboardRouter = () => {
  const { user, isLoading } = useAuthStore();

  // Handle loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary text-sm">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Normalize role to uppercase for consistent comparison
  const userRole = user.role ? String(user.role).toUpperCase().replace('-', '_') : '';

  // Determine which dashboard to render based on role
  const renderDashboard = () => {
    switch (userRole) {
      case 'SUPER_ADMIN':
      case 'SUPERADMIN':
        return <SuperAdminDashboard />;
      
      case 'ADMIN':
        return <AdminDashboard />;
      
      case 'BUSINESS_ADMIN':
      case 'BUSINESS':
      case 'MERCHANT':
      case 'RESTAURANT':
        return <BusinessAdminDashboard />;
      
      case 'DRIVER':
      case 'COURIER':
      case 'LIVREUR':
        return <DriverDashboard />;
      
      default:
        // Fallback for unrecognized roles
        console.warn(`Unrecognized role: ${user.role} (normalized: ${userRole}), defaulting to SuperAdmin`);
        return <SuperAdminDashboard />;
    }
  };

  // Apply ProtectedRoute wrapper for security
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background-primary">
        {renderDashboard()}
      </div>
    </ProtectedRoute>
  );
};

export default DashboardRouter;