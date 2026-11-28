/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/**
 * Koliwa Coursier — routage.
 *
 * Toutes les routes métier passent par `RequireCourier` : session valide,
 * rôle coursier revalidé côté serveur, et contrat signé (sinon redirection
 * vers la page de signature).
 */
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import useAuthStore from './store/authStore';
import { fetchContractStatus } from './services/legal';
import { connectDispatch } from './services/realtime';
import { Loading } from './components/ui';

import Login from './pages/Login';
import Missions from './pages/Missions';
import MissionDetail from './pages/MissionDetail';
import CourierMap from './pages/CourierMap';
import Earnings from './pages/Earnings';
import Account from './pages/Account';
import Contract from './pages/Contract';

const RequireCourier = ({ children }) => {
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [contract, setContract] = useState({ checked: false, pending: false, error: null });
  const location = useLocation();

  useEffect(() => {
    if (!token) return;
    const socket = connectDispatch();
    socket.connect?.();
  }, [token]);

  // Session restaurée depuis le stockage local : le rôle est revalidé serveur.
  useEffect(() => {
    if (token && !isHydrated) refreshProfile();
  }, [token, isHydrated, refreshProfile]);

  useEffect(() => {
    if (!token || !isHydrated) return;
    if (location.pathname === '/contrat') {
      setContract({ checked: true, pending: false, error: null });
      return;
    }
    let cancelled = false;
    fetchContractStatus()
      .then((data) => {
        if (!cancelled) setContract({ checked: true, pending: Boolean(data?.pending), error: null });
      })
      .catch(() => {
        // Serveur injoignable : on n'enferme pas le livreur hors de son espace.
        if (!cancelled) setContract({ checked: true, pending: false, error: null });
      });
    return () => {
      cancelled = true;
    };
  }, [token, isHydrated, location.pathname]);

  if (!token) return <Navigate to="/login" replace />;
  if (!isHydrated) {
    return (
      <div className="app">
        <Loading label="Vérification de votre compte…" />
      </div>
    );
  }
  if (!contract.checked) return <Loading label="Vérification de votre contrat…" />;
  if (contract.pending) return <Navigate to="/contrat" replace />;

  return children;
};

/* Chaque écran affiche son propre message d'erreur : l'app ne double pas l'affichage. */
const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/contrat"
        element={
          <RequireCourier>
            <Contract />
          </RequireCourier>
        }
      />
      <Route
        path="/missions"
        element={
          <RequireCourier>
            <Missions />
          </RequireCourier>
        }
      />
      <Route
        path="/missions/:id"
        element={
          <RequireCourier>
            <MissionDetail />
          </RequireCourier>
        }
      />
      <Route path="/carte" element={<RequireCourier><CourierMap /></RequireCourier>} />
      <Route
        path="/gains"
        element={
          <RequireCourier>
            <Earnings />
          </RequireCourier>
        }
      />
      <Route
        path="/compte"
        element={
          <RequireCourier>
            <Account />
          </RequireCourier>
        }
      />
      <Route path="*" element={<Navigate to="/missions" replace />} />
    </Routes>
  );
};

export default App;
