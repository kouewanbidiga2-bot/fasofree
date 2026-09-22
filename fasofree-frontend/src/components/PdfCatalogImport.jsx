import React, { useState, useCallback } from 'react';
import api from '../services/api';

/**
 * Import de catalogue depuis un PDF (Gemini AI).
 *
 * Étapes :
 * 1. Upload du PDF → analyse par Gemini
 * 2. Preview éditable du résultat
 * 3. Confirmation → création des produits
 */
const PdfCatalogImport = ({ businessId, onImportComplete, onClose }) => {
  const [step, setStep] = useState('upload'); // upload | analyzing | preview | importing | done
  const [pdfFile, setPdfFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [createdCount, setCreatedCount] = useState(0);

  // ─── Upload & Analyse ──────────────────────────────────────────────────

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setError(null);
    } else {
      setError('Veuillez sélectionner un fichier PDF');
    }
  };

  const handleAnalyze = async () => {
    if (!pdfFile) return;

    setStep('analyzing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);

      const response = await api.post('/products/import-pdf/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setPreview(response.data.data);
        setStep('preview');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'analyse du PDF');
      setStep('upload');
    }
  };

  // ─── Édition du preview ────────────────────────────────────────────────

  const updateProduct = (catIndex, prodIndex, field, value) => {
    setPreview((prev) => {
      const updated = { ...prev };
      updated.categories = [...prev.categories];
      updated.categories[catIndex] = {
        ...updated.categories[catIndex],
        products: [...updated.categories[catIndex].products],
      };
      updated.categories[catIndex].products[prodIndex] = {
        ...updated.categories[catIndex].products[prodIndex],
        [field]: value,
      };
      return updated;
    });
  };

  const removeProduct = (catIndex, prodIndex) => {
    setPreview((prev) => {
      const updated = { ...prev };
      updated.categories = [...prev.categories];
      updated.categories[catIndex] = {
        ...updated.categories[catIndex],
        products: updated.categories[catIndex].products.filter((_, i) => i !== prodIndex),
      };
      // Supprimer la catégorie si vide
      updated.categories = updated.categories.filter((c) => c.products.length > 0);
      updated.totalProducts = updated.categories.reduce((sum, c) => sum + c.products.length, 0);
      return updated;
    });
  };

  const updateCategory = (catIndex, value) => {
    setPreview((prev) => {
      const updated = { ...prev };
      updated.categories = [...prev.categories];
      updated.categories[catIndex] = {
        ...updated.categories[catIndex],
        name: value,
      };
      return updated;
    });
  };

  // ─── Confirmation ──────────────────────────────────────────────────────

  const handleConfirm = async () => {
    setStep('importing');
    setError(null);

    try {
      const response = await api.post('/products/import-pdf/confirm', {
        businessId,
        categories: preview.categories,
        setAvailable: true,
      });

      if (response.data.success) {
        setCreatedCount(response.data.created.length);
        setStep('done');
        onImportComplete?.();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la création des produits');
      setStep('preview');
    }
  };

  // ─── Styles ────────────────────────────────────────────────────────────

  const styles = {
    overlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    modal: {
      background: '#fff', borderRadius: 12, padding: 24,
      maxWidth: 700, width: '90%', maxHeight: '85vh', overflow: 'auto',
    },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#2D2A26' },
    subtitle: { fontSize: 14, color: '#70645C', marginBottom: 16 },
    uploadZone: {
      border: '2px dashed #C1652E', borderRadius: 12, padding: 40,
      textAlign: 'center', cursor: 'pointer', marginBottom: 16,
      backgroundColor: '#FAF6F1',
    },
    btn: (bg, color = '#fff') => ({
      padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
      backgroundColor: bg, color, fontSize: 14, fontWeight: 'bold',
    }),
    btnRow: { display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 },
    categoryCard: {
      border: '1px solid #E8E0D8', borderRadius: 8, padding: 16, marginBottom: 12,
    },
    productRow: {
      display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0',
      borderBottom: '1px solid #f0f0f0',
    },
    input: {
      padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd',
      fontSize: 13, flex: 1,
    },
    priceInput: { width: 100, textAlign: 'right' },
    removeBtn: {
      background: 'none', border: 'none', color: '#C44D56',
      cursor: 'pointer', fontSize: 18, padding: '0 4px',
    },
    spinner: {
      textAlign: 'center', padding: 40, fontSize: 16, color: '#70645C',
    },
    success: {
      textAlign: 'center', padding: 40,
    },
    error: {
      background: '#FFF0F0', color: '#C44D56', padding: 12,
      borderRadius: 8, marginBottom: 16, fontSize: 14,
    },
  };

  // ─── Rendu par étape ──────────────────────────────────────────────────

  if (step === 'analyzing') {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div style={styles.spinner}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
            <div style={{ fontWeight: 'bold', fontSize: 18 }}>Analyse en cours...</div>
            <div style={{ marginTop: 8, color: '#999' }}>
              Gemini analyse votre menu — quelques secondes
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'importing') {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div style={styles.spinner}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div style={{ fontWeight: 'bold', fontSize: 18 }}>Création des produits...</div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div style={styles.success}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>
              {createdCount} produits créés avec succès !
            </div>
            <button style={styles.btn('#C1652E')} onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.title}>
          {step === 'upload' ? '📄 Importer un menu depuis un PDF' : '📋 Vérifiez le résultat'}
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {/* ─── Étape 1 : Upload ─── */}
        {step === 'upload' && (
          <>
            <div style={styles.subtitle}>
              Uploadez votre menu PDF — l'IA extraira automatiquement les plats, prix et catégories.
            </div>
            <div style={styles.uploadZone} onClick={() => document.getElementById('pdf-input').click()}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>📁</div>
              <div style={{ fontWeight: 'bold' }}>
                {pdfFile ? pdfFile.name : 'Cliquez pour sélectionner un PDF'}
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                Max 10 MB — Format PDF uniquement
              </div>
              <input
                id="pdf-input"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
            <div style={styles.btnRow}>
              <button style={styles.btn('#999')} onClick={onClose}>Annuler</button>
              <button
                style={styles.btn(pdfFile ? '#C1652E' : '#ccc')}
                onClick={handleAnalyze}
                disabled={!pdfFile}
              >
                🤖 Analyser le menu
              </button>
            </div>
          </>
        )}

        {/* ─── Étape 2 : Preview éditable ─── */}
        {step === 'preview' && preview && (
          <>
            <div style={styles.subtitle}>
              {preview.totalProducts} produits trouvés dans {preview.categories.length} catégories.
              Modifiez avant de valider.
            </div>

            {preview.categories.map((cat, catIdx) => (
              <div key={catIdx} style={styles.categoryCard}>
                <input
                  style={{ ...styles.input, fontWeight: 'bold', fontSize: 15, marginBottom: 8 }}
                  value={cat.name}
                  onChange={(e) => updateCategory(catIdx, e.target.value)}
                  placeholder="Nom de la catégorie"
                />
                {cat.products.map((prod, prodIdx) => (
                  <div key={prodIdx} style={styles.productRow}>
                    <input
                      style={styles.input}
                      value={prod.name}
                      onChange={(e) => updateProduct(catIdx, prodIdx, 'name', e.target.value)}
                      placeholder="Nom"
                    />
                    <input
                      style={{ ...styles.input, flex: 1.5 }}
                      value={prod.description || ''}
                      onChange={(e) => updateProduct(catIdx, prodIdx, 'description', e.target.value)}
                      placeholder="Description"
                    />
                    <input
                      style={{ ...styles.input, ...styles.priceInput }}
                      type="number"
                      value={prod.price || ''}
                      onChange={(e) => updateProduct(catIdx, prodIdx, 'price', Number(e.target.value))}
                      placeholder="Prix"
                    />
                    <span style={{ color: '#999', fontSize: 12 }}>FCFA</span>
                    <button
                      style={styles.removeBtn}
                      onClick={() => removeProduct(catIdx, prodIdx)}
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ))}

            <div style={styles.btnRow}>
              <button style={styles.btn('#999')} onClick={() => setStep('upload')}>
                ← Retour
              </button>
              <button style={styles.btn('#5C6B3C')} onClick={handleConfirm}>
                ✅ Créer {preview.totalProducts} produits
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PdfCatalogImport;
