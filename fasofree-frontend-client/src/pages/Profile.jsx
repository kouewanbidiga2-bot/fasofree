import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Phone, Heart, ArrowLeft, LogOut, Settings, Bell, CreditCard, Receipt as ReceiptIcon, Package, Crown } from 'lucide-react';
import Footer from '../components/Footer';
import useAuthStore from '../store/authStore';
import { api } from '../services/api';

const Profile = () => {
  const navigate = useNavigate();
  const { user, orders, receipts, logout, updateUser } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const me = await api.getProfile();
        const name = me.fullName || me.name || '';
        setFormData((prev) => ({
          ...prev,
          name,
          email: me.email || '',
          phone: me.phone || '',
        }));
        updateUser({ name, email: me.email, phone: me.phone, id: me.id });
      } catch {
        // silent — keep local defaults
      }
    };
    loadProfile();
  }, []);

  const favoriteItems = [
    {
      id: 1,
      name: 'Cesar Burger',
      restaurant: 'Cesar',
      image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400',
      price: 4000,
    },
    {
      id: 2,
      name: '8 Wings',
      restaurant: 'BelChiken',
      image: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400',
      price: 5000,
    },
  ];

  const menuItems = [
    { icon: Crown, label: 'FasoFree Pass VIP', action: () => navigate('/vip-pass'), highlight: user?.isPremium },
    { icon: MapPin, label: 'Adresses de livraison', action: () => {} },
    { icon: CreditCard, label: 'Modes de paiement', action: () => {} },
    { icon: Bell, label: 'Notifications', action: () => {} },
    { icon: Settings, label: 'Paramètres', action: () => {} },
    { icon: LogOut, label: 'Déconnexion', action: handleLogout, variant: 'danger' },
  ];

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated = await api.updateProfile({
        fullName: formData.name,
        email: formData.email,
        phone: formData.phone,
      });
      const name = updated.fullName || updated.name || formData.name;
      updateUser({ name, email: updated.email, phone: updated.phone });
      setFormData((prev) => ({ ...prev, name, email: updated.email, phone: updated.phone }));
      setIsEditing(false);
    } catch (err) {
      alert(err.message || 'Erreur lors de la mise à jour du profil.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-background-secondary transition-colors"
            >
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg font-display font-bold text-text-primary">Mon Profil</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Profile Card */}
          <div className="border border-border-light p-4">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-background-secondary flex items-center justify-center">
                  <User size={24} className="text-text-secondary" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-medium text-text-primary">{formData.name}</h2>
                    {user?.isPremium && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase flex items-center gap-1">
                        <Crown size={10} /> VIP
                      </span>
                    )}
                  </div>
                  <p className="text-text-secondary text-sm">{formData.email}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                {isEditing ? 'Annuler' : 'Modifier'}
              </button>
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Nom complet</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-background-secondary border-0 text-sm text-text-primary focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-background-secondary border-0 text-sm text-text-primary focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Téléphone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-background-secondary border-0 text-sm text-text-primary focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Adresse</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 bg-background-secondary border-0 text-sm text-text-primary focus:outline-none transition-colors"
                  />
                </div>
                <button onClick={handleSave} className="w-full px-4 py-3 text-sm font-medium text-white transition-colors" style={{ backgroundColor: '#C1652E' }} disabled={loading}>
                  {loading ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-text-secondary">
                  <Phone size={16} className="text-text-secondary" strokeWidth={1.5} />
                  <span>{formData.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-text-secondary">
                  <MapPin size={16} className="text-text-secondary" strokeWidth={1.5} />
                  <span>{formData.address}</span>
                </div>
              </div>
            )}
          </div>

          {/* Orders */}
          <div className="border border-border-light p-4">
            <div className="flex items-center gap-2 mb-6">
              <Package size={16} className="text-accent-primary" strokeWidth={1.5} />
              <h2 className="text-sm font-medium text-text-secondary">Mes commandes</h2>
            </div>

            {orders.length > 0 ? (
              <div className="space-y-3">
                {orders.map((order, index) => (
                  <div key={index} className="bg-background-secondary p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-mono text-text-primary">{order.id || `FF${Date.now().toString().slice(-8)}`}</span>
                      <span className="text-xs text-text-secondary">
                        {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-sm text-text-primary">{order.restaurant || 'Restaurant'}</p>
                    <p className="text-xs text-text-secondary">{order.items?.length || 0} article(s)</p>
                    <p className="text-sm font-mono mt-1" style={{ color: '#C1652E' }}>
                      {(order.total || 0).toLocaleString()} FCFA
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package size={32} className="mx-auto text-text-secondary mb-4" strokeWidth={1.5} />
                <p className="text-text-secondary text-sm">Aucune commande pour le moment</p>
              </div>
            )}
          </div>

          {/* Receipts */}
          <div className="border border-border-light p-4">
            <div className="flex items-center gap-2 mb-6">
              <ReceiptIcon size={16} className="text-accent-primary" strokeWidth={1.5} />
              <h2 className="text-sm font-medium text-text-secondary">Mes reçus</h2>
            </div>

            {receipts.length > 0 ? (
              <div className="space-y-3">
                {receipts.map((receipt, index) => (
                  <div key={index} className="bg-background-secondary p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-mono text-text-primary">{receipt.orderId}</span>
                      <span className="text-xs text-text-secondary">
                        {new Date(receipt.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-sm text-text-primary">{receipt.paymentMethod || 'Paiement'}</p>
                    <p className="text-xs text-text-secondary">{receipt.status || 'Payé'}</p>
                    <p className="text-sm font-mono mt-1" style={{ color: '#C1652E' }}>
                      {(receipt.total || 0).toLocaleString()} FCFA
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ReceiptIcon size={32} className="mx-auto text-text-secondary mb-4" strokeWidth={1.5} />
                <p className="text-text-secondary text-sm">Aucun reçu pour le moment</p>
              </div>
            )}
          </div>

          {/* Favorites */}
          <div className="border border-border-light p-4">
            <div className="flex items-center gap-2 mb-6">
              <Heart size={20} className="text-accent-primary" strokeWidth={1.5} />
              <h2 className="text-sm font-medium text-text-secondary">Favoris</h2>
            </div>

            <div className="text-center py-8">
              <Heart size={48} className="mx-auto text-text-secondary mb-4" strokeWidth={1} />
              <p className="text-text-secondary text-sm">Aucun favori pour le moment</p>
            </div>
          </div>

          {/* Menu Items */}
          <div className="border border-border-light">
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
                        ? 'hover:bg-red-50 text-red-600'
                        : 'hover:bg-background-secondary text-text-primary'
                    }`}
                  >
                    <Icon size={16} strokeWidth={1.5} />
                    <span className="flex-1 text-left font-medium text-sm">{item.label}</span>
                    {item.highlight && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase">
                        VIP
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/order-history')}
              className="px-4 py-3 text-sm font-medium border border-border-light text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-colors"
            >
              Mes commandes
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-3 text-sm font-medium border border-border-light text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-colors"
            >
              Commander
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Profile;
