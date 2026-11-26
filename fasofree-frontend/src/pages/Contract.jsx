/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/**
 * Contrat de coursier — signature par code reçu par email/SMS.
 * Tant qu'il n'est pas signé, le livreur ne peut pas accéder aux courses.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Shell';
import { Loading, ErrorNote, GoodNote } from '../components/ui';
import { fetchContractStatus, requestContractOtp, signContract, fetchLegalDocument } from '../services/legal';

const Contract = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState({ loading: true, pending: false, docCode: null });
  const [document, setDocument] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchContractStatus();
      setStatus({ loading: false, pending: Boolean(data?.pending), docCode: data?.docCode || data?.document?.code || null });
      const docCode = data?.docCode || data?.document?.code;
      if (docCode) {
        try {
          setDocument(await fetchLegalDocument(docCode));
        } catch {
          /* le texte reste optionnel : la signature ne doit pas en dépendre */
        }
      }
      setError(null);
    } catch (err) {
      setStatus({ loading: false, pending: false, docCode: null });
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestContractOtp();
      setInfo('Code envoyé. Saisissez-le ci-dessous pour signer.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signContract(code.trim());
      setInfo('Contrat signé. Bienvenue chez Koliwa.');
      await load();
      navigate('/missions', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (status.loading) {
    return (
      <Shell title="Contrat">
        <Loading />
      </Shell>
    );
  }

  if (!status.pending) {
    return (
      <Shell title="Contrat">
        <GoodNote>Votre contrat est signé. Vous pouvez accepter des courses.</GoodNote>
        <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/missions')}>
          Aller aux courses
        </button>
      </Shell>
    );
  }

  return (
    <Shell title="Contrat">
      <div className="card">
        <span className="strong">Signez votre contrat de coursier</span>
        <span className="muted">
          Obligatoire avant votre première course. Un code vous est envoyé pour confirmer votre accord.
        </span>
      </div>

      {document?.title || document?.content ? (
        <div className="card" style={{ maxHeight: 260, overflowY: 'auto' }}>
          {document.title ? <span className="strong">{document.title}</span> : null}
          {document.content ? (
            <p className="muted" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{document.content}</p>
          ) : null}
        </div>
      ) : null}

      <ErrorNote>{error}</ErrorNote>
      <GoodNote>{info}</GoodNote>

      <button type="button" className="btn btn-block" disabled={busy} onClick={sendOtp}>
        {busy ? 'Envoi…' : 'Recevoir mon code'}
      </button>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="field">
          <label htmlFor="code">Code reçu</label>
          <input
            id="code"
            className="input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.length < 4}>
          {busy ? 'Signature…' : 'Signer le contrat'}
        </button>
      </form>
    </Shell>
  );
};

export default Contract;
