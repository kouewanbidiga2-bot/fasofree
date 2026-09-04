import React, { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { api } from '../../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.fasofree.site/api/v1';

const StoryCreator = ({ businessId, onClose, onCreated }) => {
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState('IMAGE');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      setError('Formats acceptes: images et videos');
      return;
    }

    if (isVideo && file.size > 50 * 1024 * 1024) {
      setError('Video trop lourde (max 50 Mo)');
      return;
    }

    if (isImage && file.size > 5 * 1024 * 1024) {
      setError('Image trop lourde (max 5 Mo)');
      return;
    }

    setMediaFile(file);
    setMediaType(isVideo ? 'VIDEO' : 'IMAGE');
    setMediaPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleSubmit = async () => {
    if (!mediaFile) {
      setError('Selectionnez un media');
      return;
    }

    setUploading(true);
    setError('');

    try {
      let mediaUrl;

      if (mediaType === 'IMAGE') {
        const fd = new FormData();
        fd.append('file', mediaFile);
        const uploadRes = await api.uploadImage(fd);
        mediaUrl = uploadRes?.url || uploadRes?.filePath;
      } else {
        throw new Error('Upload video non supporte pour l\'instant');
      }

      if (!mediaUrl) throw new Error('Echec upload');

      await api.createStory({
        businessId,
        mediaUrl,
        mediaType,
        caption: caption.trim() || undefined,
      });

      onCreated?.();
      onClose();
    } catch (err) {
      setError(err?.message || 'Echec de la publication');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8e0d4]">
          <h3 className="font-semibold text-[#29231e]">Nouvelle story</h3>
          <button onClick={onClose} className="text-[#70645C] hover:text-[#29231e] p-1">
            <X size={20} />
          </button>
        </div>

        <div className="relative aspect-[9/16] max-h-[50vh] bg-[#f5f0ea] flex items-center justify-center overflow-hidden">
          {mediaPreview ? (
            mediaType === 'VIDEO' ? (
              <video src={mediaPreview} className="w-full h-full object-cover" controls muted />
            ) : (
              <img src={mediaPreview} alt="" className="w-full h-full object-cover" />
            )
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-3 text-[#70645C]"
            >
              <div className="w-16 h-16 rounded-full bg-[#e8e0d4] flex items-center justify-center">
                <Upload size={24} />
              </div>
              <span className="text-sm font-medium">Appuyez pour ajouter un media</span>
              <span className="text-xs text-[#a09388]">Image (max 5 Mo)</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        <div className="px-4 py-3">
          <input
            type="text"
            placeholder="Ajouter une legende..."
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 280))}
            className="w-full text-sm text-[#29231e] placeholder:text-[#a09388] outline-none"
          />
        </div>

        {error && (
          <div className="px-4 pb-2">
            <p className="text-xs text-red-500">{error}</p>
          </div>
        )}

        <div className="flex gap-2 px-4 pb-4">
          {mediaPreview && (
            <button
              onClick={() => {
                setMediaFile(null);
                setMediaPreview(null);
              }}
              className="flex-1 py-2.5 rounded-xl border border-[#d6cfc4] text-sm font-medium text-[#70645C] hover:bg-[#f5f0ea] transition-colors"
            >
              Changer
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!mediaFile || uploading}
            className="flex-1 py-2.5 rounded-xl bg-[#C1652E] text-sm font-semibold text-white hover:bg-[#a85522] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Publication...' : 'Publier'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryCreator;
