import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Clock, Heart } from 'lucide-react';
import { api } from '../../services/api';
import useAuthStore from '../../store/authStore';

const StoryViewer = ({ stories, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  const [progress, setProgress] = useState(0);
  const [likedStates, setLikedStates] = useState({});
  const [likesCounts, setLikesCounts] = useState({});
  const timerRef = useRef(null);
  const STORY_DURATION = 5000;
  const { user } = useAuthStore();
  const isMerchant = user?.role === 'business_admin' || user?.role === 'BUSINESS_ADMIN' || user?.role === 'super_admin' || user?.role === 'SUPER_ADMIN';

  const currentGroup = stories[currentIndex];
  const currentStory = currentGroup?.stories?.[0];

  useEffect(() => {
    const initialLiked = {};
    const initialCounts = {};
    stories.forEach((g) => {
      g.stories?.forEach((s) => {
        initialLiked[s.id] = s.isLiked || false;
        initialCounts[s.id] = s.likesCount || 0;
      });
    });
    setLikedStates(initialLiked);
    setLikesCounts(initialCounts);
  }, [stories]);

  const startProgress = useCallback(() => {
    setProgress(0);
    clearInterval(timerRef.current);
    const interval = 50;
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += interval;
      setProgress((elapsed / STORY_DURATION) * 100);
      if (elapsed >= STORY_DURATION) {
        clearInterval(timerRef.current);
        goNext();
      }
    }, interval);
  }, [currentIndex, stories.length]);

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  useEffect(() => {
    if (currentStory?.id) {
      api.viewStory(currentStory.id).catch(() => {});
    }
    startProgress();
    return () => clearInterval(timerRef.current);
  }, [currentIndex, currentStory?.id, startProgress]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, onClose]);

  const handleLike = async () => {
    if (!currentStory?.id) return;
    const isCurrentlyLiked = likedStates[currentStory.id];

    setLikedStates((prev) => ({ ...prev, [currentStory.id]: !isCurrentlyLiked }));

    try {
      if (isCurrentlyLiked) {
        const res = await api.unlikeStory(currentStory.id);
        setLikesCounts((prev) => ({ ...prev, [currentStory.id]: res.data.likesCount }));
      } else {
        const res = await api.likeStory(currentStory.id);
        setLikesCounts((prev) => ({ ...prev, [currentStory.id]: res.data.likesCount }));
      }
    } catch {
      setLikedStates((prev) => ({ ...prev, [currentStory.id]: isCurrentlyLiked }));
    }
  };

  if (!currentGroup || !currentStory) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <div className="relative w-full h-full max-w-md mx-auto">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-3 pt-4">
          {stories.map((g, i) => (
            <div key={g.businessId} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-100"
                style={{
                  width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-0 right-0 z-20 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
              {currentGroup.businessImage ? (
                <img src={currentGroup.businessImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-sm font-bold">
                  {currentGroup.businessName?.slice(0, 2)?.toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="text-white text-sm font-semibold">{currentGroup.businessName}</p>
              <p className="text-white/60 text-xs">
                {new Date(currentStory.createdAt).toLocaleDateString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1">
            <X size={22} />
          </button>
        </div>

        {/* Media */}
        <div className="w-full h-full">
          {currentStory.mediaType === 'VIDEO' ? (
            <video
              src={currentStory.mediaUrl}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
          ) : (
            <img
              src={currentStory.mediaUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Caption */}
        {currentStory.caption && (
          <div className="absolute bottom-16 left-0 right-0 z-20 px-4">
            <p className="text-white text-sm bg-black/40 rounded-lg px-3 py-2 backdrop-blur-sm">
              {currentStory.caption}
            </p>
          </div>
        )}

        {/* Bottom bar: likes (all) + views (merchants only) + timer */}
        <div className="absolute bottom-6 left-0 right-0 z-20 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* Like button (all users) */}
            <button
              onClick={handleLike}
              className="flex items-center gap-2 bg-black/50 hover:bg-black/70 rounded-full px-4 py-2 transition-all border border-white/20 hover:border-white/40"
            >
              <Heart
                size={22}
                className={likedStates[currentStory.id] ? 'fill-red-500 text-red-400' : 'text-white'}
              />
              <span className={`text-sm font-semibold ${likedStates[currentStory.id] ? 'text-red-400' : 'text-white'}`}>
                {likesCounts[currentStory.id] || 0}
              </span>
            </button>

            {/* View count (merchants only) */}
            {isMerchant && (
              <div className="flex items-center gap-2 bg-black/50 hover:bg-black/70 rounded-full px-4 py-2 transition-all border border-white/20">
                <Eye size={18} className="text-white" />
                <span className="text-sm font-semibold text-white">{currentStory.viewsCount || 0} vues</span>
              </div>
            )}
          </div>

          {/* Time remaining */}
          <div className="flex items-center gap-1.5 bg-black/50 rounded-full px-3 py-2 border border-white/20">
            <Clock size={14} className="text-white/80" />
            <span className="text-xs text-white/80">
              {Math.max(0, Math.round((new Date(currentStory.expiresAt) - Date.now()) / 3600000))}h
            </span>
          </div>
        </div>

        {/* Navigation arrows (desktop) */}
        {currentIndex > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 hidden md:flex"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {currentIndex < stories.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 hidden md:flex"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Touch zones for mobile */}
        <div className="absolute inset-y-0 left-0 w-1/3 z-10 md:hidden" onClick={goPrev} />
        <div className="absolute inset-y-0 right-0 w-1/3 z-10 md:hidden" onClick={goNext} />
      </div>
    </div>
  );
};

export default StoryViewer;
