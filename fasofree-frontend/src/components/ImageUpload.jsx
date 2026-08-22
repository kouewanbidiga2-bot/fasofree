import { useState, useRef } from 'react';
import { Image, Upload, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.fasofree.site/api/v1';

function getAbsoluteImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) {
    try { return new URL(API_URL).origin + url; } catch { return url; }
  }
  return url;
}

export default function ImageUpload({ value, onChange, folder = 'general', className = '' }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      setError('Formats acceptés : JPEG, PNG, WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Fichier trop volumineux (max 5 Mo)');
      return;
    }

    setError('');
    setUploading(true);
    try {
      const token = localStorage.getItem('fasofree_token');
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch(`${API_URL}/uploads/image?folder=${folder}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Échec upload');

      onChange(data.url);
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onChange('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
        Image du produit
      </label>

      {value && (
        <div className="relative mb-2 w-full h-32 rounded-lg overflow-hidden border border-border-light bg-background-secondary">
          <img
            src={getAbsoluteImageUrl(value)}
            alt="Aperçu"
            className="w-full h-full object-cover"
            onError={(e) => { e.target.onerror = null; e.target.src = ''; }}
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFile}
          className="hidden"
          id={`img-upload-${folder}`}
        />
        <label
          htmlFor={`img-upload-${folder}`}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-border-light bg-background-secondary text-text-secondary hover:bg-background-tertiary cursor-pointer transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {uploading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-text-secondary/30 border-t-text-secondary rounded-full animate-spin" />
              Upload en cours...
            </>
          ) : (
            <>
              <Upload size={14} strokeWidth={1.5} />
              {value ? 'Changer l\'image' : 'Choisir une image'}
            </>
          )}
        </label>
      </div>

      <input
        className="input-field mt-2"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ou collez une URL d'image"
      />

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
