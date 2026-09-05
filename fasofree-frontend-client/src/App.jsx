import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import P2PDelivery from './pages/P2PDelivery';
import RideBooking from './pages/RideBooking';
import Restaurant from './pages/Restaurant';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Receipt from './pages/Receipt';
import OrderTracking from './pages/OrderTracking';
import OrderHistory from './pages/Orders';
import Profile from './pages/Profile';
import VipPass from './pages/VipPass';
import Addresses from './pages/Addresses';
import Settings from './pages/Settings';
import Register from './pages/Register';
import MerchantDashboard from './pages/MerchantDashboard';
import MerchantProducts from './pages/MerchantProducts';
import MerchantOrders from './pages/MerchantOrders';
import MerchantWallet from './pages/MerchantWallet';
import MerchantSettings from './pages/MerchantSettings';
import Auth from './pages/Auth';
import VerifyAccount from './pages/VerifyAccount';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Loading from './pages/Loading';
import SearchPage from './pages/Search';
import Layout from './components/navigation/Layout';
import useAuthStore from './store/authStore';
import { needsVerification } from './store/authStore';
import { registerFcmTokenOnLogin } from './services/pushRegistration';
import { initFirebase, onForegroundMessage } from './services/firebase';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated || !user) {
    return <Navigate to="/auth" replace />;
  }

  if (needsVerification(user) && window.location.pathname !== '/verify-account') {
    return <Navigate to="/verify-account" state={{ email: user.email }} replace />;
  }

  return children;
};

function App() {
  const { isAuthenticated } = useAuthStore();

  // Initialiser Firebase + demander permission push au chargement
  useEffect(() => {
    if (!isAuthenticated) return;

    initFirebase();
    registerFcmTokenOnLogin();

    // Écouter les notifications push en premier plan
    const unsubscribe = onForegroundMessage((payload) => {
      console.info('[FCM Foreground]', payload.title, payload.body);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated]);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/loading" element={<Loading />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/login" element={<Navigate to="/auth" replace />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-account" element={<VerifyAccount />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
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
          <Route path="/order-history" element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/vip-pass" element={<ProtectedRoute><VipPass /></ProtectedRoute>} />
          <Route path="/addresses" element={<ProtectedRoute><Addresses /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Route>

        {/* Merchant pages */}
        <Route path="/merchant-dashboard" element={<ProtectedRoute><MerchantDashboard /></ProtectedRoute>} />
        <Route path="/merchant/products" element={<ProtectedRoute><MerchantProducts /></ProtectedRoute>} />
        <Route path="/merchant/orders" element={<ProtectedRoute><MerchantOrders /></ProtectedRoute>} />
        <Route path="/merchant/wallet" element={<ProtectedRoute><MerchantWallet /></ProtectedRoute>} />
        <Route path="/merchant/settings" element={<ProtectedRoute><MerchantSettings /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
