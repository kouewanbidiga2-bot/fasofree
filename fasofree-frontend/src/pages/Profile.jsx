/**
 * FasoFree — Profil (Client)
 * Affiche les informations de l'utilisateur, historique, reçus via API
 */
import React, { useState, useEffect } from 'react';
// ✅ CORRECT
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { User, MapPin, Phone, ArrowLeft, LogOut, Settings, Bell, CreditCard, Receipt as ReceiptIcon, Package, Edit2, Check, ShieldCheck } from 'lucide-react';
import Footer from '../components/Footer';
import useAuthStore from '../store/authStore';
import { getWalletTransactions } from '../services/walletService';

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser, refreshProfile } = useAuthStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    refreshProfile();
    // Charger l'historique des transactions du wallet si client
    if (user?.id) {
      // Simulation pour le profil client s'il n'a pas de vrai wallet dans ce MVP
    }
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Simulation appel API pour update
      updateUser(formData);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const menuItems = [
    { icon: MapPin, label: 'Adresses enregistrées', action: () => {} },
    { icon: CreditCard, label: 'Moyens de paiement', action: () => {} },
    { icon: Bell, label: 'Préférences notifications', action: () => {} },
    { icon: Settings, label: 'Paramètres du compte', action: () => {} },
    { icon: LogOut, label: 'Se déconnecter', action: handleLogout, variant: 'danger' },
  ];

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      {/* ─── HEADER ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background-card/90 backdrop-blur-glass border-b border-border-light">
        <div className="content-wrapper py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="btn-icon">
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-lg font-bold text-text-primary">Mon Profil</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 content-wrapper py-8 max-w-2xl mx-auto w-full">
        <div className="animate-slide-up space-y-6">

          {/* ─── CARTE PROFIL ────────────────────────────────────────── */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center border border-accent-primary/30">
                  <span className="text-2xl font-bold">
                    {(user?.fullName || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">{user?.fullName || 'Utilisateur'}</h2>
                  <p className="text-text-secondary text-sm">{user?.email}</p>
                  <span className="inline-block mt-1 badge-paid uppercase text-[10px]">{user?.role || 'Client'}</span>
                </div>
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="btn-icon bg-background-secondary hover:bg-border-light"
              >
                {isEditing ? <ArrowLeft size={16} /> : <Edit2 size={16} />}
              </button>
            </div>

            {isEditing ? (
              <div className="space-y-4 animate-fade-in border-t border-border-light pt-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase">Nom complet</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field"
                  />
                </div>
                <button 
                  onClick={handleSave} 
                  disabled={loading}
                  className="btn-primary w-full mt-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Check size={16} /> Enregistrer les modifications</>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-3 border-t border-border-light pt-4 mt-4">
                <div className="flex items-center gap-3 text-sm text-text-primary p-3 bg-background-secondary rounded-lg">
                  <Phone size={16} className="text-accent-primary" />
                  <span className="font-mono">{user?.phone || 'Non renseigné'}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-background-secondary rounded-lg">
                   <div className="flex items-center gap-3 text-sm text-text-primary">
                    <ShieldCheck size={16} className="text-status-success" />
                    <span>Compte vérifié</span>
                   </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── RACCOURCIS COMMANDES ───────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/order-history')}
              className="card-hover p-5 text-center flex flex-col items-center justify-center gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-accent-primary/10 flex items-center justify-center">
                <Package size={24} className="text-accent-primary" />
              </div>
              <div>
                <p className="font-bold text-text-primary text-sm">Mes Commandes</p>
                <p className="text-text-tertiary text-xs mt-0.5">Historique et suivi</p>
              </div>
            </button>
            
            <button
              onClick={() => {}}
              className="card-hover p-5 text-center flex flex-col items-center justify-center gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-accent-primary/10 flex items-center justify-center">
                <ReceiptIcon size={24} className="text-accent-primary" />
              </div>
              <div>
                <p className="font-bold text-text-primary text-sm">Mes Reçus</p>
                <p className="text-text-tertiary text-xs mt-0.5">Factures et paiements</p>
              </div>
            </button>
          </div>

          {/* ─── MENU SETTINGS ──────────────────────────────────────── */}
          <div className="card overflow-hidden">
            <div className="divide-y divide-border-light">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                const isDanger = item.variant === 'danger';

                return (
                  <button
                    key={index}
                    onClick={item.action}
                    className={`w-full flex items-center gap-4 p-4 transition-colors ${
                      isDanger
                        ? 'hover:bg-status-errorBg group'
                        : 'hover:bg-background-secondary'
                    }`}
                  >
                    <Icon 
                      size={18} 
                      className={isDanger ? 'text-status-error' : 'text-text-secondary'} 
                    />
                    <span className={`flex-1 text-left font-bold text-sm ${isDanger ? 'text-status-error' : 'text-text-primary'}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Profile;
