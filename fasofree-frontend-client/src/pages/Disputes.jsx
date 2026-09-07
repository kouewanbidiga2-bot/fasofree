import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import api from '../services/api';

const STATUS_CONFIG = {
  OPEN: { label: 'Ouvert', color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: Clock },
  UNDER_INVESTIGATION: { label: 'En cours', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: Eye },
  PENDING_ADMIN_APPROVAL: { label: 'En attente', color: 'text-orange-500', bg: 'bg-orange-500/10', icon: Clock },
  APPROVED: { label: 'Approuve', color: 'text-green-500', bg: 'bg-green-500/10', icon: CheckCircle },
  REJECTED: { label: 'Rejete', color: 'text-red-500', bg: 'bg-red-500/10', icon: XCircle },
};

export default function Disputes() {
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getMyDisputes();
        setDisputes(Array.isArray(data) ? data : []);
      } catch {
        setDisputes([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getStatusInfo = (status) => STATUS_CONFIG[status] || { label: status, color: 'text-gray-500', bg: 'bg-gray-500/10', icon: AlertTriangle };

  return (
    <div className="min-h-screen bg-background-primary">
      <header className="sticky top-0 z-30 bg-background-primary/95 backdrop-blur-sm border-b border-border-light">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-background-secondary">
            <ChevronLeft size={20} className="text-text-primary" />
          </button>
          <h1 className="text-lg font-bold text-text-primary">Mes reclamations</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-xl bg-background-secondary animate-pulse" />
            ))}
          </div>
        ) : disputes.length === 0 ? (
          <div className="text-center py-16">
            <AlertTriangle size={40} className="mx-auto text-text-secondary/30 mb-4" />
            <p className="text-text-secondary font-medium">Aucune reclamation</p>
            <p className="text-sm text-text-secondary/70 mt-1">Vous n'avez signale aucun probleme.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {disputes.map(d => {
              const st = getStatusInfo(d.status);
              const Icon = st.icon;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelected(selected?.id === d.id ? null : d)}
                  className="w-full text-left p-4 rounded-xl border border-border-light bg-background-card hover:border-accent-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg} ${st.color}`}>
                          <Icon size={10} /> {st.label}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-text-primary truncate">{d.reason || 'Litige'}</p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Commande #{d.orderId?.slice(-8)} · {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <ChevronLeft size={16} className={`text-text-secondary transition-transform ${selected?.id === d.id ? 'rotate-[-90deg]' : ''}`} />
                  </div>

                  {selected?.id === d.id && (
                    <div className="mt-3 pt-3 border-t border-border-light space-y-2 text-sm">
                      <div>
                        <p className="text-xs text-text-secondary mb-0.5">Description</p>
                        <p className="text-text-primary">{d.description || 'Aucune description'}</p>
                      </div>
                      {d.supportNote && (
                        <div>
                          <p className="text-xs text-text-secondary mb-0.5">Reponse support</p>
                          <p className="text-text-primary">{d.supportNote}</p>
                        </div>
                      )}
                      {d.adminNote && (
                        <div>
                          <p className="text-xs text-text-secondary mb-0.5">Decision admin</p>
                          <p className="text-text-primary">{d.adminNote}</p>
                        </div>
                      )}
                      {d.refundAmount && (
                        <div>
                          <p className="text-xs text-text-secondary mb-0.5">Montant rembourse</p>
                          <p className="text-accent-primary font-bold">{Number(d.refundAmount).toLocaleString()} FCFA</p>
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/order-tracking?orderId=${d.orderId}`); }}
                        className="text-xs text-accent-primary font-semibold hover:underline"
                      >
                        Voir la commande
                      </button>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
