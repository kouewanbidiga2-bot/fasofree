import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-7xl font-bold text-accent-primary mb-4">404</p>
        <h1 className="text-xl font-semibold text-text-primary mb-2">Page introuvable</h1>
        <p className="text-sm text-text-secondary mb-8">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border-light text-text-secondary hover:bg-background-secondary transition-colors text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Retour
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent-primary text-white hover:opacity-90 transition-opacity text-sm font-medium"
          >
            <Home size={16} />
            Accueil
          </button>
        </div>
      </div>
    </div>
  );
}
