/**
 * FasoFree — Candidatures (Onboarding Marchands & Livreurs)
 * Approbation / rejet des dossiers de candidature envoyés via POST /auth/apply.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  Store,
  Bike,
  FileText,
  ExternalLink,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import { StatCard, StatusBadge, LoadingSkeleton, EmptyState } from './components/StatCard';
import { getApplications, approveApplication, rejectApplication } from '../services/onboardingService';
import { getKycPending, getKycDocumentUrl } from '../services/kycService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const API_ORIGIN = API_URL.replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
const resolveFileUrl = (u) => (u && !u.startsWith('http') ? `${API_ORIGIN}${u}` : u);

const STATUS_CONFIG = {
  PENDING_APPROVAL: { label: 'En attente', color: 'warning', dot: '#F59E0B' },
  APPROVED: { label: 'Approuvé', color: 'success', dot: '#22C55E' },
  REJECTED: { label: 'Rejeté', color: 'error', dot: '#EF4444' },
};

const KYC_LABELS = {
  IDENTITY_CARD: 'Carte d’identité',
  DRIVER_LICENSE: 'Permis de conduire',
  VEHICLE_REGISTRATION: 'Carte grise / Assur. véhicule',
};

const ApplicationsDashboard = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [filters, setFilters] = useState({ type: '', status: 'PENDING_APPROVAL' });
  const [busy, setBusy] = useState(null);
  const [selected, setSelected] = useState(null);
  const [kycDocs, setKycDocs] = useState(null);
  const [kycLoading, setKycLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const params = {};
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      const data = await getApplications(params);
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const openExaminer = async (app) => {
    setSelected(app);
    setKycDocs(null);
    setKycLoading(true);
    try {
      const pending = await getKycPending();
      const owned = (Array.isArray(pending) ? pending : []).filter((d) => d.ownerId === app.id);
      const withUrls = await Promise.all(
        owned.map(async (d) => {
          try {
            const url = await getKycDocumentUrl(d.id);
            return { ...d, url: resolveFileUrl(url) };
          } catch {
            return { ...d, url: null };
          }
        }),
      );
      setKycDocs(withUrls);
    } catch {
      setKycDocs([]);
    } finally {
      setKycLoading(false);
    }
  };

  const handleApprove = async (app) => {
    setBusy(app.id);
    setMsg(null);
    try {
      await approveApplication(app.id);
      setMsg({ type: 'success', text: `Candidature de ${app.fullName} approuvée. Identifiants envoyés.` });
      if (selected?.id === app.id) setSelected(null);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async (app) => {
    const reason = window.prompt(`Motif du rejet pour ${app.fullName} (obligatoire) :`);
    if (reason === null) return;
    if (!reason.trim()) {
      setMsg({ type: 'error', text: 'Le motif du rejet est obligatoire.' });
      return;
    }
    setBusy(app.id);
    setMsg(null);
    try {
      await rejectApplication(app.id, reason.trim());
      setMsg({ type: 'success', text: `Candidature de ${app.fullName} rejetée.` });
      if (selected?.id === app.id) setSelected(null);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

  const pendingCount = applications.filter((a) => a.applicationStatus === 'PENDING_APPROVAL').length;
  const merchantPending = applications.filter(
    (a) => a.applicationType === 'MERCHANT' && a.applicationStatus === 'PENDING_APPROVAL',
  ).length;
  const driverPending = applications.filter(
    (a) => a.applicationType === 'DRIVER' && a.applicationStatus === 'PENDING_APPROVAL',
  ).length;

  return (
    <div className="min-h-screen bg-background-primary p-6 lg:p-8">
      <header className="flex items-center justify-between mb-6 pb-4 border-b border-border-light">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-lg hover:bg-background-secondary text-text-secondary"
            title="Retour"
          >
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Candidatures</h1>
            <p className="text-text-secondary text-sm">
              Dossiers Marchands &amp; Livreurs en attente d’approbation.
            </p>
          </div>
        </div>
        <button onClick={load} className="btn-secondary gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="En attente (total)" value={pendingCount} icon={ClipboardList} color="#F59E0B" loading={loading} />
        <StatCard label="Marchands en attente" value={merchantPending} icon={Store} color="#C1652E" loading={loading} />
        <StatCard label="Livreurs en attente" value={driverPending} icon={Bike} color="#3B82F6" loading={loading} />
      </div>

      {/* Filtres */}
      <div className="card p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Profil</label>
          <select
            className="input-field"
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="">Tous</option>
            <option value="MERCHANT">Marchand</option>
            <option value="DRIVER">Livreur</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Statut</label>
          <select
            className="input-field"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">Tous</option>
            <option value="PENDING_APPROVAL">En attente</option>
            <option value="APPROVED">Approuvé</option>
            <option value="REJECTED">Rejeté</option>
          </select>
        </div>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-lg border text-sm mb-6 ${
            msg.type === 'success'
              ? 'bg-status-successBg border-status-success/30 text-status-success'
              : 'bg-status-errorBg border-status-error/30 text-status-error'
          }`}
        >
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5">
              <LoadingSkeleton height="h-4" className="mb-2" />
              <LoadingSkeleton height="h-3" width="w-2/3" />
            </div>
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title="Aucune candidature"
            description="Aucun dossier ne correspond à ces critères."
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Candidat</th>
                <th>Profil</th>
                <th>Détails</th>
                <th>Statut</th>
                <th>Soumise le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const data = app.applicationData || {};
                const detail =
                  app.applicationType === 'MERCHANT'
                    ? data.businessName || '—'
                    : `${data.vehicleType || '—'} ${data.driverLicenseNumber ? `· ${data.driverLicenseNumber}` : ''}`;
                return (
                  <tr key={app.id}>
                    <td>
                      <p className="font-semibold text-text-primary text-sm">{app.fullName}</p>
                      <p className="text-text-tertiary text-xs">{app.email} · {app.phone}</p>
                    </td>
                    <td>
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                          app.applicationType === 'MERCHANT'
                            ? 'bg-accent-primary/10 text-accent-primary'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {app.applicationType === 'MERCHANT' ? <Store size={11} /> : <Bike size={11} />}
                        {app.applicationType === 'MERCHANT' ? 'Marchand' : 'Livreur'}
                      </span>
                    </td>
                    <td>
                      <p className="text-text-secondary text-xs line-clamp-1 max-w-xs">{detail}</p>
                    </td>
                    <td>
                      <StatusBadge status={app.applicationStatus} statusConfig={STATUS_CONFIG} />
                      {app.applicationStatus === 'REJECTED' && app.rejectionReason && (
                        <p className="text-text-tertiary text-[10px] mt-1 line-clamp-1 max-w-[180px]">
                          {app.rejectionReason}
                        </p>
                      )}
                    </td>
                    <td>
                      <p className="text-text-tertiary text-xs">{formatDate(app.createdAt)}</p>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openExaminer(app)}
                          className="btn-icon text-accent-primary hover:bg-background-secondary"
                          title="Examiner"
                        >
                          <Eye size={14} />
                        </button>
                        {app.applicationStatus === 'PENDING_APPROVAL' && (
                          <>
                            <button
                              onClick={() => handleApprove(app)}
                              disabled={busy === app.id}
                              className="btn-icon text-status-success hover:bg-status-successBg disabled:opacity-50"
                              title="Approuver"
                            >
                              {busy === app.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <CheckCircle size={14} />
                              )}
                            </button>
                            <button
                              onClick={() => handleReject(app)}
                              disabled={busy === app.id}
                              className="btn-icon text-status-error hover:bg-status-errorBg disabled:opacity-50"
                              title="Rejeter"
                            >
                              <XCircle size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Panneau d'examen ─── */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-background-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-elevated">
            <div className="p-6 border-b border-border-light flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-text-primary">
                  Candidature — {selected.fullName}
                </h2>
                <p className="text-text-secondary text-sm">{selected.email} · {selected.phone}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="btn-icon text-text-secondary hover:bg-background-secondary"
                title="Fermer"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={selected.applicationStatus} statusConfig={STATUS_CONFIG} />
                <span
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                    selected.applicationType === 'MERCHANT'
                      ? 'bg-accent-primary/10 text-accent-primary'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {selected.applicationType === 'MERCHANT' ? 'Marchand' : 'Livreur'}
                </span>
                <span className="text-text-tertiary text-xs">Soumise le {formatDate(selected.createdAt)}</span>
              </div>

              {selected.rejectionReason && (
                <div className="bg-status-errorBg border border-status-error/30 text-status-error text-sm p-3 rounded-lg">
                  Motif du rejet : {selected.rejectionReason}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-background-secondary rounded-lg p-4">
                  <p className="text-xs font-semibold text-text-secondary uppercase mb-2">Référence</p>
                  <p className="font-mono text-xs text-text-primary break-all">{selected.id}</p>
                  <p className="text-xs font-semibold text-text-secondary uppercase mb-2 mt-3">Code de parrainage</p>
                  <p className="font-mono text-sm font-bold text-accent-primary">{selected.referralCode || '—'}</p>
                </div>

                <div className="bg-background-secondary rounded-lg p-4">
                  <p className="text-xs font-semibold text-text-secondary uppercase mb-2">
                    {selected.applicationType === 'MERCHANT' ? 'Commerce' : 'Profil livreur'}
                  </p>
                  {selected.applicationType === 'MERCHANT' ? (
                    <div className="space-y-1 text-sm">
                      <p><span className="text-text-secondary">Nom :</span> <span className="font-medium text-text-primary">{selected.applicationData?.businessName || '—'}</span></p>
                      <p><span className="text-text-secondary">Adresse :</span> <span className="font-medium text-text-primary">{selected.applicationData?.businessAddress || '—'}</span></p>
                      <p><span className="text-text-secondary">Catégorie :</span> <span className="font-medium text-text-primary">{selected.applicationData?.businessCategory || '—'}</span></p>
                      {(selected.applicationData?.latitude !== undefined && selected.applicationData?.longitude !== undefined) && (
                        <p><span className="text-text-secondary">Position :</span> <span className="font-medium text-text-primary">{selected.applicationData.latitude}, {selected.applicationData.longitude}</span></p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1 text-sm">
                      <p><span className="text-text-secondary">Véhicule :</span> <span className="font-medium text-text-primary">{selected.applicationData?.vehicleType || '—'}</span></p>
                      <p><span className="text-text-secondary">Permis :</span> <span className="font-medium text-text-primary">{selected.applicationData?.driverLicenseNumber || '—'}</span></p>
                    </div>
                  )}
                </div>
              </div>

              {/* Documents KYC */}
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase mb-2 flex items-center gap-1">
                  <FileText size={13} /> Documents KYC fournis
                </p>
                {kycLoading ? (
                  <p className="text-sm text-text-secondary">Chargement des documents…</p>
                ) : kycDocs && kycDocs.length > 0 ? (
                  <ul className="space-y-2">
                    {kycDocs.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between bg-background-secondary rounded-lg px-4 py-3">
                        <span className="text-sm text-text-primary">{KYC_LABELS[doc.type] || doc.type}</span>
                        {doc.url ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-accent-primary hover:underline"
                          >
                            Ouvrir <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-xs text-text-tertiary">Indisponible</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-text-tertiary">Aucun document (facultatif).</p>
                )}
              </div>

              {selected.applicationStatus === 'PENDING_APPROVAL' && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleApprove(selected)}
                    disabled={busy === selected.id}
                    className="btn-primary flex-1 gap-2 disabled:opacity-50"
                  >
                    {busy === selected.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle size={16} />
                    )}
                    Approuver &amp; envoyer les identifiants
                  </button>
                  <button
                    onClick={() => handleReject(selected)}
                    disabled={busy === selected.id}
                    className="btn-secondary flex-1 gap-2 text-status-error border-status-error/30 disabled:opacity-50"
                  >
                    <XCircle size={16} />
                    Rejeter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationsDashboard;
