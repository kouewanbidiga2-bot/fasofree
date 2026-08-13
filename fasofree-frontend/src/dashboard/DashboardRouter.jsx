import React from 'react';
import  Navigate  from 'react-router-dom';
import useAuthStore  from '../store/authStore';

import SuperAdminDashboard from './SuperAdminDashboard';

const AdminDashboard = () => <div className="p-8 text-black font-bold">Dashboard Admin (En construction)</div>;
const BusinessDashboard = () => <div className="p-8 text-black font-bold">Dashboard Commerçant (En construction)</div>;
const DeliveryDashboard = () => <div className="p-8 text-black font-bold">Dashboard Livreur (En construction)</div>;
const CustomerDashboard = () => <div className="p-8 text-black font-bold">Dashboard Client (En construction)</div>;

const DashboardRouter = () => {
  const { user, isLoading } = useAuthStore();

  // 🔍 LOG SENIOR : Regarde la console de ton navigateur (F12)
  console.log("🚦 ETAT DU ROUTEUR :", { isLoading, user });

  // 1. SI LE CHARGEMENT EST BLOQUÉ
  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white text-black p-4">
        <h1 className="text-3xl font-bold text-red-600 mb-4">⚠️ BLOQUÉ DANS ISLOADING</h1>
        <p>Ton frontend attend la réponse du backend pour vérifier l'utilisateur.</p>
        <p>Vérifie que ton backend (NestJS) tourne bien et n'a pas crashé !</p>
      </div>
    );
  }

  // 2. SI AUCUN UTILISATEUR
  if (!user) {
    console.log("🔴 Pas d'utilisateur, redirection vers /auth");
    return <Navigate to="/auth" replace />;
  }

  const normalizedRole = user?.role ? String(user.role).toLowerCase().replace('-', '_') : '';

  // 3. SI LE ROUTEUR MARCHE MAIS QUE SUPER_ADMIN CRASH
  const renderDashboard = () => {
    switch (normalizedRole) {
      case 'super_admin':
      case 'superadmin':
        return <SuperAdminDashboard />;
      case 'admin':
        return <AdminDashboard />;
      case 'business':
      case 'merchant':
      case 'restaurant':
        return <BusinessDashboard />;
      case 'driver':
      case 'delivery':
      case 'livreur':
        return <DeliveryDashboard />;
      case 'customer':
      case 'client':
      case 'user':
        return <CustomerDashboard />;
      default:
        return <SuperAdminDashboard />;
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="bg-yellow-300 text-black p-2 text-center font-bold">
        ✅ Le DashboardRouter a fonctionné. Rôle chargé : {normalizedRole}
      </div>
      {renderDashboard()}
    </div>
  );
};

export default DashboardRouter;