import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './guards';

// 1. DIRECT IMPORTS for critical components (eliminates lazy loading crashes)
import Loading from './pages/Loading';
import PhoneAuth from './pages/PhoneAuth';

// 2. LAZY LOADING for dashboards (non-critical pages)
const BusinessAdminDashboard = lazy(() => import('./dashboard/BusinessAdminDashboard'));
const DriverDashboard = lazy(() => import('./dashboard/DriverDashboard'));
const SuperAdminDashboard = lazy(() => import('./dashboard/SuperAdminDashboard'));

function App() {
  return (
    <Router>
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* ROUTE PAR DÉFAUT - redirige vers la connexion */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* ROUTES D'AUTHENTIFICATION */}
          <Route path="/login" element={<PhoneAuth />} />
          <Route path="/register" element={<PhoneAuth />} />

          {/* ROUTES PRIVÉES PAR RÔLE */}
          <Route
            path="/designer"
            element={
              <ProtectedRoute allowedRoles={['business_admin', 'business', 'merchant', 'restaurant']}>
                <BusinessAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/livreur"
            element={
              <ProtectedRoute allowedRoles={['driver', 'courier', 'livreur']}>
                <DriverDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/financier"
            element={
              <ProtectedRoute allowedRoles={['super_admin', 'superadmin']}>
                <SuperAdminDashboard />
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
