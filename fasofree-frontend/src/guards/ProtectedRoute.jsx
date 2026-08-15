/**
 * FasoFree - Protected Route Guard
 * 
 * Security barrier that ensures only authenticated users can access protected routes.
 * Redirects unauthenticated users to /login and preserves the intended destination.
 * 
 * Features:
 * - JWT validation
 * - Role-based access control (optional)
 * - Automatic redirect to auth page
 * - Preservation of intended destination
 * - Loading state handling
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const ProtectedRoute = ({ 
  children, 
  allowedRoles = [], // Optional: Array of allowed roles
  requireAuth = true // Default: require authentication
}) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary text-sm">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (requireAuth && !isAuthenticated) {
    // Store the intended location for redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access control if allowedRoles are specified
  if (allowedRoles.length > 0 && user?.role) {
    const normalizedRole = String(user.role).toLowerCase().replace('-', '_');
    const hasAccess = allowedRoles.some(role => 
      String(role).toLowerCase().replace('-', '_') === normalizedRole
    );

    if (!hasAccess) {
      // Redirect to appropriate dashboard or unauthorized page
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // User is authenticated and authorized
  return children;
};

export default ProtectedRoute;