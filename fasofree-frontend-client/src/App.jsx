/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import Home from './pages/Home';
import P2PDelivery from './pages/P2PDelivery';
import RideBooking from './pages/RideBooking';
import Restaurant from './pages/Restaurant';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Receipt from './pages/Receipt';
import OrderTracking from './pages/OrderTracking';
import PaymentError from './pages/PaymentError';
import OrderHistory from './pages/Orders';
import Profile from './pages/Profile';
import VipPass from './pages/VipPass';
import Addresses from './pages/Addresses';
import Settings from './pages/Settings';
import Disputes from './pages/Disputes';
import NotFound from './pages/NotFound';
import Register from './pages/Register';
import Auth from './pages/Auth';
import VerifyAccount from './pages/VerifyAccount';
import LegalDocPage from './pages/LegalDocPage';
import Loading from './pages/Loading';
import SearchPage from './pages/Search';
import Layout from './components/navigation/Layout';
import AssistantWidget from './components/AssistantWidget';
import useAuthStore from './store/authStore';
import { needsVerification } from './store/authStore';
import { persistFcmToken } from './services/pushRegistration';
import { initFirebase, onForegroundMessage, setupPermissionRetry } from './services/firebase';

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated || !user) {
    // Mémorise la destination voulue pour y revenir après connexion
    return <Navigate to="/auth" replace state={{ from: location.pathname + location.search }} />;
  }

  if (needsVerification(user) && window.location.pathname !== '/verify-account') {
    return <Navigate to="/verify-account" state={{ email: user.email }} replace />;
  }

  return children;
};

function App() {
  const { isAuthenticated } = useAuthStore();

  // Initialiser Firebase + configurer la relance de permission push
  // ⚠️ Garde stricte : tant que VITE_PUSH_ENABLED n'est pas "true", rien ne
  // demande la permission de notification (pas de prompt au premier chargement).
  useEffect(() => {
    if (!isAuthenticated) return;
    const pushEnabled =
      String(import.meta.env.VITE_PUSH_ENABLED || '').toLowerCase() === 'true';
    if (!pushEnabled) return;

    initFirebase();
    // ⚠️ `onToken` est OBLIGATOIRE : c'est ce qui enregistre réellement le token
    // FCM côté API (POST /notifications/fcm-token). Sans lui, le token récupéré
    // était jeté → `users.fcmToken` restait NULL → 0 destinataire de push.
    setupPermissionRetry({ onToken: persistFcmToken }); // prompt initial + relance clics/focus

    // Écouter les notifications push en premier plan
    const unsubscribe = onForegroundMessage((payload) => {
      console.info('[FCM Foreground]', payload.title, payload.body);
      // Toast visible quand l'app est ouverte (sonner est déjà monté via <Toaster />).
      try {
        toast(payload.title || 'FasoFree', {
          description: payload.body,
          action: payload.data?.orderId
            ? {
                label: 'Voir la commande',
                onClick: () => {
                  window.location.href = `/order-tracking?id=${payload.data.orderId}`;
                },
              }
            : undefined,
        });
      } catch {
        // sonner indisponible : le log console suffit.
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated]);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster position="top-center" richColors duration={4000} />
      <AssistantWidget />
      <Routes>
        <Route path="/loading" element={<Loading />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/login" element={<Navigate to="/auth" replace />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-account" element={<VerifyAccount />} />
        {/* ⚖️ Pages légales — contenu servi par le backend (/legal/documents) */}
        <Route path="/terms" element={<LegalDocPage docCode="FR-CGU-001" />} />
        <Route path="/privacy" element={<LegalDocPage docCode="FR-PRIV-002" />} />
        <Route path="/cookies" element={<LegalDocPage docCode="FR-COOK-003" />} />
        <Route path="/cgv" element={<LegalDocPage docCode="FR-CGV-004" />} />
        <Route path="/remboursement" element={<LegalDocPage docCode="FR-RMB-008" />} />
        <Route path="/legal/:docCode" element={<LegalDocPage />} />
        <Route path="/ride" element={<ProtectedRoute><RideBooking /></ProtectedRoute>} />
        <Route path="/p2p-delivery" element={<P2PDelivery />} />

        {/* Pages avec BottomNav mobile */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/restaurant/:id" element={<Restaurant />} />
          <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="/receipt" element={<ProtectedRoute><Receipt /></ProtectedRoute>} />
          <Route path="/order-tracking" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
          {/* Page dédiée aux échecs de paiement (retour passerelle ou
              initiation échouée) — jamais pour les autres erreurs. */}
          <Route path="/payment-error" element={<ProtectedRoute><PaymentError /></ProtectedRoute>} />
          <Route path="/order-history" element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/vip-pass" element={<ProtectedRoute><VipPass /></ProtectedRoute>} />
          <Route path="/addresses" element={<ProtectedRoute><Addresses /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/disputes" element={<ProtectedRoute><Disputes /></ProtectedRoute>} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
