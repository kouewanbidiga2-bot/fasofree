import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, Globe, Moon, ChevronRight, Eye, Trash2, Lock,
  Download, Bell, ChevronDown, Check
} from 'lucide-react';
import useAuthStore from '../store/authStore';

export default function Settings() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [openSection, setOpenSection] = useState(null);

  const toggle = (key) => setOpenSection(openSection === key ? null : key);

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

          {/* Confidentialite */}
          <div className="border border-border-light">
            <button
              onClick={() => toggle('privacy')}
              className="w-full flex items-center justify-between p-4 hover:bg-background-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <Shield size={18} className="text-text-secondary" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Confidentialite</p>
                  <p className="text-xs text-text-secondary">Gerez vos donnees personnelles</p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-text-secondary transition-transform ${openSection === 'privacy' ? 'rotate-180' : ''}`}
              />
            </button>
            {openSection === 'privacy' && (
              <div className="border-t border-border-light p-4 space-y-3 bg-background-secondary/50">
                <button className="w-full flex items-center gap-3 p-3 hover:bg-background-secondary transition-colors text-left">
                  <Eye size={16} className="text-text-secondary" />
                  <div>
                    <p className="text-sm text-text-primary">Qui peut voir mon profil</p>
                    <p className="text-xs text-text-secondary">Visible par les partenaires uniquement</p>
                  </div>
                </button>
                <button className="w-full flex items-center gap-3 p-3 hover:bg-background-secondary transition-colors text-left">
                  <Download size={16} className="text-text-secondary" />
                  <div>
                    <p className="text-sm text-text-primary">Telecharger mes donnees</p>
                    <p className="text-xs text-text-secondary">Recuperez une copie de vos informations</p>
                  </div>
                </button>
                <button className="w-full flex items-center gap-3 p-3 hover:bg-red-50 transition-colors text-left">
                  <Trash2 size={16} className="text-red-500" />
                  <div>
                    <p className="text-sm text-red-600">Supprimer mon compte</p>
                    <p className="text-xs text-text-secondary">Action irreversible</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Langue */}
          <div className="border border-border-light">
            <button
              onClick={() => toggle('lang')}
              className="w-full flex items-center justify-between p-4 hover:bg-background-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <Globe size={18} className="text-text-secondary" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Langue</p>
                  <p className="text-xs text-text-secondary">Francais</p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-text-secondary transition-transform ${openSection === 'lang' ? 'rotate-180' : ''}`}
              />
            </button>
            {openSection === 'lang' && (
              <div className="border-t border-border-light p-4 bg-background-secondary/50">
                <LangOption label="Francais" code="fr" active />
                <LangOption label="English" code="en" />
                <LangOption label="Moore" code="mo" />
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="border border-border-light">
            <button
              onClick={() => toggle('notif')}
              className="w-full flex items-center justify-between p-4 hover:bg-background-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <Bell size={18} className="text-text-secondary" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Notifications</p>
                  <p className="text-xs text-text-secondary">Gerez vos alertes</p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-text-secondary transition-transform ${openSection === 'notif' ? 'rotate-180' : ''}`}
              />
            </button>
            {openSection === 'notif' && (
              <div className="border-t border-border-light p-4 space-y-3 bg-background-secondary/50">
                <ToggleRow label="Commandes" desc="Statut de vos commandes" defaultOn />
                <ToggleRow label="Promotions" desc="Offres et bons plans" defaultOn />
                <ToggleRow label="Nouveaux restaurants" desc="Quand un partenaire rejoint FasoFree" />
              </div>
            )}
          </div>

          {/* Securite */}
          <div className="border border-border-light">
            <button
              onClick={() => toggle('security')}
              className="w-full flex items-center justify-between p-4 hover:bg-background-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <Lock size={18} className="text-text-secondary" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Securite</p>
                  <p className="text-xs text-text-secondary">Mot de passe et securite du compte</p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-text-secondary transition-transform ${openSection === 'security' ? 'rotate-180' : ''}`}
              />
            </button>
            {openSection === 'security' && (
              <div className="border-t border-border-light p-4 space-y-3 bg-background-secondary/50">
                <button className="w-full flex items-center gap-3 p-3 hover:bg-background-secondary transition-colors text-left">
                  <Lock size={16} className="text-text-secondary" />
                  <div className="flex-1">
                    <p className="text-sm text-text-primary">Changer le mot de passe</p>
                  </div>
                  <ChevronRight size={14} className="text-text-secondary" />
                </button>
              </div>
            )}
          </div>

          {/* A propos */}
          <div className="border border-border-light">
            <button
              onClick={() => toggle('about')}
              className="w-full flex items-center justify-between p-4 hover:bg-background-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <Globe size={18} className="text-text-secondary" />
                <div>
                  <p className="text-sm font-medium text-text-primary">A propos</p>
                  <p className="text-xs text-text-secondary">Version 1.0.0</p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-text-secondary transition-transform ${openSection === 'about' ? 'rotate-180' : ''}`}
              />
            </button>
            {openSection === 'about' && (
              <div className="border-t border-border-light p-4 bg-background-secondary/50 space-y-2">
                <p className="text-xs text-text-secondary">FasoFree — Livraison rapide au Burkina Faso</p>
                <a href="/terms" className="block text-sm text-[#C1652E]">Conditions generales</a>
                <a href="/privacy" className="block text-sm text-[#C1652E]">Politique de confidentialite</a>
              </div>
            )}
          </div>

          {/* Deconnexion */}
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="w-full border border-red-200 p-4 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors mt-6"
          >
            Se deconnecter
          </button>
        </div>
      </div>
    </div>
  );
}

function LangOption({ label, code, active }) {
  return (
    <button className="w-full flex items-center justify-between p-3 hover:bg-background-secondary transition-colors text-left">
      <span className="text-sm text-text-primary">{label}</span>
      {active ? <Check size={14} className="text-[#C1652E]" /> : <span className="w-3.5" />}
    </button>
  );
}

function ToggleRow({ label, desc, defaultOn = false }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between p-3">
      <div>
        <p className="text-sm text-text-primary">{label}</p>
        <p className="text-xs text-text-secondary">{desc}</p>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={`relative w-10 h-5 rounded-full transition-colors ${on ? 'bg-[#C1652E]' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
