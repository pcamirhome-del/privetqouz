import React, {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {Check, Image as ImageIcon, Send, Shuffle, X} from 'lucide-react';
import {PartnerRole, PhotosLiveState, SharedPhotoItem} from '../types/app';
import {soundEngine} from '../services/sound';

interface PhotosTabProps {
  role: PartnerRole;
  photos: SharedPhotoItem[];
  photosState: PhotosLiveState | null;
  onUpdatePhotosState: (next: PhotosLiveState) => Promise<void>;
}

export const PhotosTab: React.FC<PhotosTabProps> = ({
  role,
  photos,
  photosState,
  onUpdatePhotosState,
}) => {
  const [localShuffling, setLocalShuffling] = useState(false);
  const [showApproveNote, setShowApproveNote] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [bannerNote, setBannerNote] = useState<string | null>(null);

  const activePhoto = photos.find((p) => p.id === photosState?.activePhotoId) || null;
  const pendingRequest =
    photosState?.rerollRequest && photosState.rerollRequest.status === 'pending'
      ? photosState.rerollRequest
      : null;

  // Trigger 3-second shuffle animation whenever shuffleId changes
  useEffect(() => {
    if (!photosState?.isShuffling || !photosState.shuffleId) return;
    setLocalShuffling(true);
    const timer = setTimeout(() => {
      setLocalShuffling(false);
      soundEngine.playWin();
      if (photosState.chosenBy === role && photos.length > 0) {
        const picked = photos[Math.floor(Math.random() * photos.length)];
        onUpdatePhotosState({
          ...photosState,
          isShuffling: false,
          activePhotoId: picked.id,
          rerollRequest: null,
          updatedAt: Date.now(),
        }).catch(() => {});
      }
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photosState?.shuffleId]);

  useEffect(() => {
    if (photosState?.rerollRequest?.note) {
      setBannerNote(photosState.rerollRequest.note);
      const t = setTimeout(() => setBannerNote(null), 6000);
      return () => clearTimeout(t);
    }
  }, [photosState?.rerollRequest?.note]);

  const startShuffle = async () => {
    if (photos.length === 0) return;
    soundEngine.playTick();
    await onUpdatePhotosState({
      photoIds: photosState?.photoIds || photos.map((p) => p.id),
      activePhotoId: null,
      isShuffling: true,
      shuffleId: `shuf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      chosenBy: role,
      rerollRequest: null,
      updatedAt: Date.now(),
    });
  };

  const handleRandomPickClick = async () => {
    if (photos.length === 0 || localShuffling) return;

    // If a photo was already chosen, require partner approval before re-rolling
    if (photosState?.activePhotoId) {
      await onUpdatePhotosState({
        ...photosState,
        rerollRequest: {
          requestId: `req_${Date.now()}`,
          requestedBy: role,
          status: 'pending',
          timestamp: Date.now(),
        },
        updatedAt: Date.now(),
      });
      return;
    }

    await startShuffle();
  };

  const handleCloseActivePhoto = async () => {
    if (!photosState) return;
    await onUpdatePhotosState({
      ...photosState,
      activePhotoId: null,
      updatedAt: Date.now(),
    });
  };

  const handleRejectReroll = async () => {
    if (!photosState || !pendingRequest) return;
    soundEngine.playSad();
    await onUpdatePhotosState({
      ...photosState,
      rerollRequest: {
        ...pendingRequest,
        status: 'rejected',
      },
      updatedAt: Date.now(),
    });
  };

  const handleSendApproveAndReshuffle = async () => {
    if (!photosState || !pendingRequest) return;
    soundEngine.playKissPing();
    const noteText = quickNote.trim();
    setQuickNote('');
    setShowApproveNote(false);
    await onUpdatePhotosState({
      photoIds: photosState.photoIds || photos.map((p) => p.id),
      activePhotoId: null,
      isShuffling: true,
      shuffleId: `shuf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      chosenBy: pendingRequest.requestedBy,
      rerollRequest: {
        ...pendingRequest,
        status: 'approved',
        note: noteText || undefined,
      },
      updatedAt: Date.now(),
    });
  };

  const isWaitingForPartner =
    pendingRequest && pendingRequest.requestedBy === role;
  const partnerNeedsToApprove =
    pendingRequest && pendingRequest.requestedBy !== role;

  return (
    <div className="relative flex h-full w-full flex-col gap-2.5 py-1">
      {/* Top Random Pick Button */}
      <button
        type="button"
        disabled={photos.length === 0 || localShuffling || Boolean(isWaitingForPartner)}
        onClick={handleRandomPickClick}
        className="flex w-full min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg hover:from-rose-500 hover:to-rose-400 active:scale-[0.98] transition disabled:opacity-60"
      >
        <Shuffle className={`h-4 w-4 ${localShuffling ? 'animate-spin' : ''}`} />
        <span>
          {isWaitingForPartner
            ? 'جاري موافقة الطرف الاخر...'
            : 'اختيار عشوائي'}
        </span>
      </button>

      {/* Quick note banner from partner */}
      {bannerNote && (
        <div className="shrink-0 rounded-xl border border-amber-300/35 bg-amber-500/20 px-3 py-2 text-center text-xs font-bold text-amber-100">
          رسالة الشريك: {bannerNote}
        </div>
      )}

      {photosState?.rerollRequest?.status === 'rejected' && (
        <div className="shrink-0 rounded-xl border border-rose-400/35 bg-rose-900/60 px-3 py-1.5 text-center text-[11px] font-semibold text-rose-100">
          رفض الطرف الآخر إعادة الاختيار العشوائي الآن.
        </div>
      )}

      {/* Partner Re-Roll Approval Popup */}
      <AnimatePresence>
        {partnerNeedsToApprove && (
          <motion.div
            initial={{opacity: 0, y: -8}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -8}}
            className="shrink-0 rounded-2xl border border-amber-300/40 bg-rose-950/90 p-3 text-center shadow-xl"
          >
            <p className="text-xs font-bold text-amber-200 mb-2">
              يطلب الشريك إعادة الاختيار العشوائي لصورة أخرى
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowApproveNote(true)}
                className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition"
              >
                <Check className="h-4 w-4" />
                <span>موافق</span>
              </button>
              <button
                type="button"
                onClick={handleRejectReroll}
                className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl bg-rose-700 px-3 py-2 text-xs font-bold text-white hover:bg-rose-600 transition"
              >
                <X className="h-4 w-4" />
                <span>غير موافق</span>
              </button>
            </div>

            {showApproveNote && (
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="text"
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  placeholder="اكتب رسالة سريعة لشريكك (اختياري)..."
                  maxLength={120}
                  className="flex-1 min-h-[40px] rounded-xl border border-rose-300/30 bg-black/45 px-3 py-1.5 text-xs text-white focus:border-rose-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSendApproveAndReshuffle}
                  className="flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-amber-400 transition"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>إرسال</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent Gallery Grid (No delete controls in main view) */}
      <div className="flex-1 inner-scroll rounded-2xl border border-rose-300/15 bg-black/25 p-2">
        {photos.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-4 text-rose-200/75">
            <ImageIcon className="h-10 w-10 mb-2 opacity-60" />
            <p className="text-sm font-bold text-rose-100">
              المعرض فارغ حالياً
            </p>
            <p className="mt-1 text-xs">
              أضف صوراً دائمة ومشفرة من زر الإعدادات بالأعلى لمشاركتها والسحب العشوائي.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-square overflow-hidden rounded-xl border border-rose-300/20 bg-black/40"
              >
                <img
                  src={photo.dataUrl}
                  alt={photo.caption || 'صورة مشتركة'}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3-Second Rapid Overlapping Shuffle Overlay */}
      <AnimatePresence>
        {localShuffling && photos.length > 0 && (
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-md overflow-hidden"
          >
            <div className="relative h-64 w-64">
              {photos.slice(0, 8).map((p, idx) => (
                <motion.img
                  key={p.id}
                  src={p.dataUrl}
                  alt="خلط الصور"
                  animate={{
                    x: [
                      (idx % 2 === 0 ? -1 : 1) * 70,
                      (idx % 2 === 0 ? 1 : -1) * 85,
                      0,
                      (idx % 3 === 0 ? -60 : 60),
                    ],
                    y: [
                      (idx % 3 === 0 ? -40 : 40),
                      (idx % 2 === 0 ? 50 : -50),
                      0,
                      -20,
                    ],
                    rotate: [-18, 22, -12, 16],
                    scale: [0.85, 1.08, 0.92, 1.04],
                  }}
                  transition={{
                    duration: 0.55,
                    repeat: Infinity,
                    repeatType: 'mirror',
                    delay: idx * 0.06,
                  }}
                  className="absolute inset-0 m-auto h-44 w-44 rounded-2xl border-2 border-rose-300/60 object-cover shadow-2xl"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revealed Photo Full Focus Overlay (with X button at top-left) */}
      <AnimatePresence>
        {activePhoto && !localShuffling && (
          <motion.div
            initial={{opacity: 0, scale: 0.9}}
            animate={{opacity: 1, scale: 1}}
            exit={{opacity: 0, scale: 0.9}}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          >
            <div className="relative w-full max-w-md rounded-3xl border border-rose-300/35 bg-[#1b050d]/90 p-3 shadow-2xl">
              <button
                type="button"
                onClick={handleCloseActivePhoto}
                aria-label="إغلاق الصورة"
                className="absolute top-3 left-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/75 text-white border border-white/25 hover:bg-rose-600 transition"
              >
                <X className="h-5 w-5" />
              </button>

              <img
                src={activePhoto.dataUrl}
                alt={activePhoto.caption || 'الصورة المختارة'}
                className="max-h-[65dvh] w-full rounded-2xl object-contain bg-black/40"
              />

              <div className="mt-2.5 flex items-center justify-between gap-2 px-1">
                <span className="text-xs font-bold text-rose-100 truncate">
                  {activePhoto.caption || 'صورة مختارة عشوائياً ❤️'}
                </span>
                <button
                  type="button"
                  onClick={handleRandomPickClick}
                  disabled={Boolean(isWaitingForPartner)}
                  className="shrink-0 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition disabled:opacity-60"
                >
                  {isWaitingForPartner ? 'بانتظار الموافقة...' : 'اختيار عشوائي آخر'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
