import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import P2PDelivery from './pages/P2PDelivery';
import RideBooking from './pages/RideBooking';
import DriverDashboard from './pages/DriverDashboard';
import Restaurant from './pages/Restaurant';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Receipt from './pages/Receipt';
import OrderTracking from './pages/OrderTracking';
import OrderHistory from './pages/OrderHistory';
import Profile from './pages/Profile';
import VipPass from './pages/VipPass';
import Register from './pages/Register';
import MerchantDashboard from './pages/MerchantDashboard';
import PhoneAuth from './pages/PhoneAuth';
import Auth from './pages/Auth';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Loading from './pages/Loading';
import useAuthStore from './store/authStore';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  return children;
};

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/loading" element={<Loading />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<Home />} />
        <Route path="/ride" element={<ProtectedRoute><RideBooking /></ProtectedRoute>} />
        <Route path="/driver" element={<ProtectedRoute><DriverDashboard /></ProtectedRoute>} />
        <Route path="/p2p-delivery" element={<P2PDelivery />} />
        <Route path="/restaurant/:id" element={<ProtectedRoute><Restaurant /></ProtectedRoute>} />
        <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="/receipt" element={<ProtectedRoute><Receipt /></ProtectedRoute>} />
        <Route path="/order-tracking" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
        <Route path="/order-history" element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/vip-pass" element={<ProtectedRoute><VipPass /></ProtectedRoute>} />
        <Route path="/register" element={<Register />} />
        <Route path="/merchant-dashboard" element={<ProtectedRoute><MerchantDashboard /></ProtectedRoute>} />
        <Route path="/driver-dashboard" element={<ProtectedRoute><DriverDashboard /></ProtectedRoute>} />
        <Route path="/privacy" element={<ProtectedRoute><Privacy /></ProtectedRoute>} />
        <Route path="/terms" element={<ProtectedRoute><Terms /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
