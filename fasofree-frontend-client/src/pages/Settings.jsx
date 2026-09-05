import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Globe, Moon } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();

  const items = [
    { icon: Shield, label: 'Confidentialite', desc: 'Gerez vos donnees personnelles' },
    { icon: Globe, label: 'Langue', desc: 'Francais' },
    { icon: Moon, label: 'Mode sombre', desc: 'Desactive' },
  ];

  return (
    <div className="min-h-screen bg-background-primary">
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-background-secondary transition-colors">
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg font-display font-bold text-text-primary">Parametres</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-3xl mx-auto space-y-3">
          {items.map((item) => (
            <button
              key={item.label}
              className="w-full flex items-center gap-4 border border-border-light p-4 hover:bg-background-secondary transition-colors text-left"
            >
              <item.icon size={18} className="text-text-secondary" />
              <div>
                <p className="text-sm font-medium text-text-primary">{item.label}</p>
                <p className="text-xs text-text-secondary">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
