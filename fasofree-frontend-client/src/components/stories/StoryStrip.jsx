import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../services/api';
import useAuthStore from '../../store/authStore';
import StoryViewer from './StoryViewer';
import StoryCreator from './StoryCreator';

const StoryStrip = () => {
  const [storyGroups, setStoryGroups] = useState([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [merchantBusinessId, setMerchantBusinessId] = useState(null);
  const { isAuthenticated, user } = useAuthStore();

  const isMerchant = user?.role === 'business_admin' || user?.role === 'BUSINESS_ADMIN' || user?.role === 'super_admin' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    loadStories();
    if (isMerchant) {
      loadMerchantBusiness();
    }
  }, [isMerchant]);

  const loadStories = async () => {
    try {
      const res = await api.getStories();
      if (res?.data) {
        setStoryGroups(res.data);
      }
    } catch {
      setStoryGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMerchantBusiness = async () => {
    try {
      const res = await api.getMyBusiness();
      if (res?.id) {
        setMerchantBusinessId(res.id);
      }
    } catch {
      // silent
    }
  };

  const handleStoryClick = (index) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  if (loading) return null;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto scrollbar-none py-3 px-1">
        {isMerchant && (
          <button
            onClick={() => setCreatorOpen(true)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0"
          >
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#C1652E]/40 flex items-center justify-center bg-[#C1652E]/5 hover:bg-[#C1652E]/10 transition-colors">
              <Plus size={22} className="text-[#C1652E]" />
            </div>
            <span className="text-[11px] text-[#70645C] font-medium">Votre story</span>
          </button>
        )}

        {storyGroups.map((group, index) => {
          const hasUnviewed = group.stories?.some((s) => !s.viewed);
          return (
            <button
              key={group.businessId}
              onClick={() => handleStoryClick(index)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div
                className={`w-16 h-16 rounded-full p-[2px] ${
                  hasUnviewed
                    ? 'bg-gradient-to-br from-[#C1652E] to-[#e8a379]'
                    : 'bg-[#d6cfc4]'
                }`}
              >
                <div className="w-full h-full rounded-full bg-background-primary p-[2px] overflow-hidden">
                  {group.businessImage ? (
                    <img
                      src={group.businessImage}
                      alt={group.businessName}
                      className="w-full h-full rounded-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className={`w-full h-full rounded-full bg-[#f0e6d6] items-center justify-center ${
                      group.businessImage ? 'hidden' : 'flex'
                    }`}
                  >
                    <span className="text-[#C1652E] font-bold text-sm">
                      {group.businessName?.slice(0, 2)?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              <span className="text-[11px] text-[#70645C] font-medium max-w-[64px] truncate">
                {group.businessName?.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {viewerOpen && (
        <StoryViewer
          stories={storyGroups}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {creatorOpen && merchantBusinessId && (
        <StoryCreator
          businessId={merchantBusinessId}
          onClose={() => setCreatorOpen(false)}
          onCreated={() => {
            setCreatorOpen(false);
            loadStories();
          }}
        />
      )}
    </>
  );
};

export default StoryStrip;
