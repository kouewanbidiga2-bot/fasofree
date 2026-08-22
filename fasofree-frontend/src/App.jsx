import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './guards';

// 1. DIRECT IMPORTS for critical components (eliminates lazy loading crashes)
import Loading from './pages/Loading';
import PhoneAuth from './pages/PhoneAuth';
import Unauthorized from './pages/Unauthorized';

// 2. LAZY LOADING for dashboards (non-critical pages)
const BusinessAdminDashboard = lazy(() => import('./dashboard/BusinessAdminDashboard'));
const DriverDashboard = lazy(() => import('./dashboard/DriverDashboard'));
const SuperAdminDashboard = lazy(() => import('./dashboard/SuperAdminDashboard'));
const AdminManagerDashboard = lazy(() => import('./dashboard/AdminManagerDashboard'));
const SupportDashboard = lazy(() => import('./dashboard/SupportDashboard'));
const LiveOrders = lazy(() => import('./dashboard/LiveOrders'));
const ApplicationsDashboard = lazy(() => import('./dashboard/ApplicationsDashboard'));

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* ROUTE PAR DÉFAUT */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* ROUTES D'AUTHENTIFICATION */}
          <Route path="/login" element={<PhoneAuth />} />
          <Route path="/register" element={<PhoneAuth />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ROUTES MARCHAND / COMMERÇANT */}
          <Route
            path="/designer"
            element={
              <ProtectedRoute allowedRoles={['business_admin', 'business', 'merchant', 'restaurant']}>
                <BusinessAdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* ROUTE LIVREUR */}
          <Route
            path="/livreur"
            element={
              <ProtectedRoute allowedRoles={['driver', 'courier', 'livreur']}>
                <DriverDashboard />
              </ProtectedRoute>
            }
          />

          {/* SUPER ADMIN — accès total + finances */}
          <Route
            path="/admin/super"
            element={
              <ProtectedRoute allowedRoles={['super_admin', 'superadmin']}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* ADMIN MANAGER — gestion commandes, marchands, KYC, litiges */}
          <Route
            path="/admin/manager"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminManagerDashboard />
              </ProtectedRoute>
            }
          />

          {/* SUPPORT — litiges, KYC, ban, messagerie commande */}
          <Route
            path="/admin/support"
            element={
              <ProtectedRoute allowedRoles={['support']}>
                <SupportDashboard />
              </ProtectedRoute>
            }
          />

          {/* ROUTES PARTAGÉES (tous les rôles admin) */}
          <Route
            path="/dashboard/live-orders"
            element={
              <ProtectedRoute allowedRoles={['super_admin', 'superadmin', 'admin', 'support']}>
                <LiveOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/applications"
            element={
              <ProtectedRoute allowedRoles={['super_admin', 'superadmin', 'admin', 'support']}>
                <ApplicationsDashboard />
              </ProtectedRoute>
            }
          />

          {/* ROUTE PAR DÉFAUT */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
