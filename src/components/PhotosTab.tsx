import React, {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {Image as ImageIcon, Lock, Shuffle, X} from 'lucide-react';
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

  const isWife = role === 'female';
  const isHusband = role === 'male';
  const activePhoto = photos.find((p) => p.id === photosState?.activePhotoId) || null;

  // Trigger 3-second shuffle animation whenever shuffleId changes on BOTH screens
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

  const startShuffle = async () => {
    if (!isWife || photos.length === 0 || localShuffling || activePhoto) return;
    soundEngine.playTick();
    await onUpdatePhotosState({
      photoIds: photosState?.photoIds || photos.map((p) => p.id),
      activePhotoId: null,
      isShuffling: true,
      shuffleId: `shuf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      chosenBy: 'female',
      rerollRequest: null,
      updatedAt: Date.now(),
    });
  };

  const handleCloseActivePhoto = async () => {
    if (!isHusband || !photosState) return;
    await onUpdatePhotosState({
      ...photosState,
      activePhotoId: null,
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="relative flex h-full w-full flex-col gap-2 py-1">
      {/* Top Instruction Note Box */}
      <div className="shrink-0 rounded-2xl border border-amber-300/45 bg-gradient-to-r from-rose-950/75 via-amber-950/45 to-rose-950/75 px-3 py-2 text-center shadow-md backdrop-blur-sm">
        <p className="text-[11px] sm:text-xs font-extrabold leading-relaxed text-amber-100 drop-shadow">
          عند الضغط علي اختيار عشوائي ويتم اختيار صورة عشوائيه من خلال الزوجه وتظهر علي الشاشه مطالب من الزوجه تنفيز الوضع الموجود في الصورة تماما
        </p>
      </div>

      {/* Random Pick Control: Available ONLY for Wife */}
      {isWife ? (
        <button
          type="button"
          disabled={photos.length === 0 || localShuffling || Boolean(activePhoto)}
          onClick={startShuffle}
          className="flex w-full min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg hover:from-rose-500 hover:to-rose-400 active:scale-[0.98] transition disabled:opacity-60"
        >
          <Shuffle className={`h-4 w-4 ${localShuffling ? 'animate-spin' : ''}`} />
          <span>
            {localShuffling
              ? 'جاري الاختيار العشوائي...'
              : activePhoto
                ? 'بانتظار إغلاق الصورة من الزوج'
                : 'اختيار عشوائي'}
          </span>
        </button>
      ) : (
        <div className="flex w-full min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-black/35 px-4 py-2 text-xs font-bold text-rose-100 backdrop-blur-sm">
          <Lock className="h-3.5 w-3.5 text-rose-300 shrink-0" />
          <span>الاختيار العشوائي متاح من حساب الزوجة فقط 💖</span>
        </div>
      )}

      {/* Persistent Gallery Grid */}
      <div className="flex-1 inner-scroll rounded-2xl border border-rose-200/20 bg-black/15 p-2 backdrop-blur-[2px]">
        {photos.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-4 text-rose-100 [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]">
            <ImageIcon className="h-10 w-10 mb-2 opacity-80" />
            <p className="text-sm font-bold text-white">المعرض فارغ حالياً</p>
            <p className="mt-1 text-xs font-medium">
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
                      idx % 3 === 0 ? -60 : 60,
                    ],
                    y: [
                      idx % 3 === 0 ? -40 : 40,
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

      {/* Revealed Photo Overlay (Simultaneous on both screens; ONLY Husband can close it) */}
      <AnimatePresence>
        {activePhoto && !localShuffling && (
          <motion.div
            initial={{opacity: 0, scale: 0.9}}
            animate={{opacity: 1, scale: 1}}
            exit={{opacity: 0, scale: 0.9}}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          >
            <div className="relative w-full max-w-md rounded-3xl border border-rose-300/35 bg-[#1b050d]/90 p-3 shadow-2xl">
              {isHusband && (
                <button
                  type="button"
                  onClick={handleCloseActivePhoto}
                  aria-label="إغلاق الصورة"
                  className="absolute top-3 left-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/75 text-white border border-white/25 hover:bg-rose-600 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              )}

              <img
                src={activePhoto.dataUrl}
                alt={activePhoto.caption || 'الصورة المختارة'}
                className="max-h-[65dvh] w-full rounded-2xl object-contain bg-black/40"
              />

              <div className="mt-2.5 flex items-center justify-between gap-2 px-1">
                <span className="text-xs font-bold text-rose-100 truncate">
                  {activePhoto.caption || 'صورة مختارة عشوائياً ❤️'}
                </span>
                {isHusband ? (
                  <button
                    type="button"
                    onClick={handleCloseActivePhoto}
                    className="shrink-0 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-rose-500 transition"
                  >
                    إغلاق الصورة
                  </button>
                ) : (
                  <span className="shrink-0 rounded-xl bg-white/10 px-2.5 py-1 text-[10px] font-bold text-rose-200">
                    إغلاق الصورة للزوج فقط 💙
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
