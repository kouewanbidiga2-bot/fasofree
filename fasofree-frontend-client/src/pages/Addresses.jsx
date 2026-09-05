import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Plus } from 'lucide-react';

export default function Addresses() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background-primary">
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-background-secondary transition-colors">
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg font-display font-bold text-text-primary">Adresses de livraison</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="border border-border-light p-8 text-center">
            <MapPin size={32} className="mx-auto mb-3 text-text-secondary" />
            <p className="text-text-secondary text-sm mb-4">Gerez vos adresses de livraison ici.</p>
            <button className="inline-flex items-center gap-2 bg-[#C1652E] text-white px-4 py-2.5 text-sm font-semibold">
              <Plus size={14} />
              Ajouter une adresse
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
