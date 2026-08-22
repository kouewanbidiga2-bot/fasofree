import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import useAuthStore from '../store/authStore';

const Unauthorized = () => {
  const navigate = useNavigate();
  const { logout, getDashboardRoute } = useAuthStore();

  const handleGoBack = () => {
    const route = getDashboardRoute();
    if (route && route !== '/login') {
      navigate(route, { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF6F1] p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
          <ShieldAlert size={40} className="text-red-500" strokeWidth={1.5} />
        </div>

        <h1 className="text-2xl font-bold text-[#2D2A26] mb-3">
          Accès refusé
        </h1>

        <p className="text-[#70645C] text-sm leading-relaxed mb-8">
          Vous n'avez pas les droits nécessaires pour accéder à cette page.
          <br />
          Veuillez contacter un administrateur si vous pensez qu'il s'agit d'une erreur.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleGoBack}
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#C1652E] text-white text-sm font-medium rounded-lg hover:bg-[#A5541F] transition-colors"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
            Retour à mon espace
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-3 text-[#70645C] text-sm hover:text-[#2D2A26] transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
