import React, {useState} from 'react';
import {
  AlertCircle,
  BellRing,
  CalendarHeart,
  Download,
  Eye,
  Gift,
  Image as ImageIcon,
  Link2,
  Lock,
  LogOut,
  Music,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  AmbientSoundMode,
  DEFAULT_MYSTERY_CARDS,
  DEFAULT_ROOM_SETTINGS,
  EncryptedRoomSettings,
  MediaBackgroundConfig,
  MysteryCardItem,
  PartnerRole,
  QuizRewardButton,
  SharedPhotoItem,
  WheelSegment,
} from '../types/app';
import {
  compressImageFile,
  computeImageFingerprint,
  isDuplicatePhoto,
  isGifFile,
} from '../services/mediaStore';
import {usePWAInstall} from '../hooks/usePWAInstall';
import {ambientAudio} from '../services/ambientAudio';
import {forceHardUpdateAndReload} from '../services/pwaUpdater';

type SettingsSection =
  | 'general'
  | 'background'
  | 'wheel'
  | 'quiz'
  | 'cards'
  | 'photos';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPin: string;
  role: PartnerRole;
  settings: EncryptedRoomSettings;
  photos: SharedPhotoItem[];
  onSaveSettings: (next: EncryptedRoomSettings) => Promise<void>;
  onChangePasscode: (newPin: string, nextSettings: EncryptedRoomSettings) => Promise<void>;
  onUpdateBackground: (
    type: MediaBackgroundConfig['type'],
    fileOrUrl?: File | string
  ) => Promise<void>;
  onUploadPhoto: (
    dataUrl: string,
    caption: string,
    hashes?: {contentHash: string; perceptualHash: string}
  ) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onPreviewBackgroundControls?: (
    overrides: {
      overlayOpacity?: number;
      backgroundScale?: number;
      backgroundFit?: 'cover' | 'contain';
    } | null
  ) => void;
}

const WHEEL_COLORS = [
  '#be123c',
  '#9f1239',
  '#e11d48',
  '#881337',
  '#d97706',
  '#9d174d',
  '#b91c1c',
  '#7e22ce',
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentPin,
  role,
  settings,
  photos,
  onSaveSettings,
  onChangePasscode: _onChangePasscode,
  onUpdateBackground,
  onUploadPhoto,
  onDeletePhoto,
  onSignOut,
  onPreviewBackgroundControls,
}) => {
  const [unlocked, setUnlocked] = useState(false);
  const [pinAttempt, setPinAttempt] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [section, setSection] = useState<SettingsSection>('general');

  // Editable drafts
  const [malePinDraft, setMalePinDraft] = useState(settings.malePasscode || '0000');
  const [femalePinDraft, setFemalePinDraft] = useState(
    settings.femalePasscode || '1111'
  );
  const [bannerText, setBannerText] = useState(settings.bannerText);
  const [overlayOpacity, setOverlayOpacity] = useState(settings.overlayOpacity);
  const [backgroundScale, setBackgroundScale] = useState<number>(
    settings.backgroundScale ?? 1
  );
  const [backgroundFit, setBackgroundFit] = useState<'cover' | 'contain'>(
    settings.backgroundFit ?? 'cover'
  );
  const [livePreviewMode, setLivePreviewMode] = useState(false);
  const [allowZoom, setAllowZoom] = useState(settings.allowZoom);
  const [anniversaryDate, setAnniversaryDate] = useState(
    settings.anniversaryDate || ''
  );
  const [upcomingEventDate, setUpcomingEventDate] = useState(
    settings.upcomingEventDate || ''
  );
  const [upcomingEventTitle, setUpcomingEventTitle] = useState(
    settings.upcomingEventTitle || ''
  );
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(
    settings.periodicReminderEnabled ?? true
  );
  const [reminderMinutes, setReminderMinutes] = useState<number>(
    settings.periodicReminderMinutes ?? 2
  );
  const [reminderMessage, setReminderMessage] = useState<string>(
    settings.periodicReminderMessage ||
      DEFAULT_ROOM_SETTINGS.periodicReminderMessage ||
      ''
  );
  const [rewardTargetPoints, setRewardTargetPoints] = useState<number>(
    settings.rewardTargetPoints ?? 5
  );
  const [ambientMode, setAmbientMode] = useState<AmbientSoundMode>(
    () => ambientAudio.mode
  );
  const [ambientVol, setAmbientVol] = useState<number>(
    () => ambientAudio.volume
  );
  const [ambientPlaying, setAmbientPlaying] = useState<boolean>(
    () => ambientAudio.isPlaying
  );
  const [wheelSegments, setWheelSegments] = useState<WheelSegment[]>(settings.wheelSegments);
  const [quizRewards, setQuizRewards] = useState<QuizRewardButton[]>(settings.quizRewards);
  const [mysteryCards, setMysteryCards] = useState<MysteryCardItem[]>(
    settings.mysteryCards && settings.mysteryCards.length > 0
      ? settings.mysteryCards
      : DEFAULT_MYSTERY_CARDS
  );
  const [photoCaption, setPhotoCaption] = useState('');
  const [bgDirectUrl, setBgDirectUrl] = useState('');
  const [bgDirectUrlType, setBgDirectUrlType] = useState<'image' | 'video'>('video');
  const [duplicateAlert, setDuplicateAlert] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const {isInstallable, isInstalled, install} = usePWAInstall();

  if (!isOpen) return null;

  const pushPreview = (
    nextOpacity: number,
    nextScale: number,
    nextFit: 'cover' | 'contain'
  ) => {
    onPreviewBackgroundControls?.({
      overlayOpacity: nextOpacity,
      backgroundScale: nextScale,
      backgroundFit: nextFit,
    });
  };

  const updateScale = (val: number) => {
    const clamped = Math.min(3, Math.max(0.4, Number(val.toFixed(2))));
    setBackgroundScale(clamped);
    pushPreview(overlayOpacity, clamped, backgroundFit);
  };

  const updateFit = (fit: 'cover' | 'contain') => {
    setBackgroundFit(fit);
    pushPreview(overlayOpacity, backgroundScale, fit);
  };

  const updateOpacity = (val: number) => {
    setOverlayOpacity(val);
    pushPreview(val, backgroundScale, backgroundFit);
  };

  const handleClose = () => {
    setUnlocked(false);
    setPinAttempt('');
    setPinError(null);
    setStatusMsg(null);
    setDuplicateAlert(null);
    setLivePreviewMode(false);
    onPreviewBackgroundControls?.(null);
    onClose();
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const attempt = pinAttempt.trim();
    const expectedRolePin =
      role === 'female'
        ? settings.femalePasscode || '1111'
        : settings.malePasscode || '0000';
    const malePin = settings.malePasscode || '0000';
    const femalePin = settings.femalePasscode || '1111';

    if (
      attempt === expectedRolePin ||
      attempt === malePin ||
      attempt === femalePin ||
      attempt === currentPin
    ) {
      setUnlocked(true);
      setPinError(null);
      setMalePinDraft(malePin);
      setFemalePinDraft(femalePin);
      setBannerText(settings.bannerText);
      setOverlayOpacity(settings.overlayOpacity);
      setBackgroundScale(settings.backgroundScale ?? 1);
      setBackgroundFit(settings.backgroundFit ?? 'cover');
      setLivePreviewMode(false);
      setAllowZoom(settings.allowZoom);
      setAnniversaryDate(settings.anniversaryDate || '');
      setUpcomingEventDate(settings.upcomingEventDate || '');
      setUpcomingEventTitle(settings.upcomingEventTitle || '');
      setReminderEnabled(settings.periodicReminderEnabled ?? true);
      setReminderMinutes(settings.periodicReminderMinutes ?? 2);
      setReminderMessage(
        settings.periodicReminderMessage ||
          DEFAULT_ROOM_SETTINGS.periodicReminderMessage ||
          ''
      );
      setRewardTargetPoints(settings.rewardTargetPoints ?? 5);
      setAmbientMode(ambientAudio.mode);
      setAmbientVol(ambientAudio.volume);
      setAmbientPlaying(ambientAudio.isPlaying);
      setWheelSegments(settings.wheelSegments);
      setQuizRewards(settings.quizRewards);
      setMysteryCards(
        settings.mysteryCards && settings.mysteryCards.length > 0
          ? settings.mysteryCards
          : DEFAULT_MYSTERY_CARDS
      );
    } else {
      setPinError('الرمز السري غير صحيح.');
    }
  };

  const handleSaveGeneralAndLists = async () => {
    setBusy(true);
    setStatusMsg(null);
    try {
      const mPin = malePinDraft.trim();
      const fPin = femalePinDraft.trim();
      if (mPin.length < 4 || !/^\d+$/.test(mPin)) {
        throw new Error('يجب أن يتكون رمز دخول الزوج من 4 أرقام على الأقل.');
      }
      if (fPin.length < 4 || !/^\d+$/.test(fPin)) {
        throw new Error('يجب أن يتكون رمز دخول الزوجة من 4 أرقام على الأقل.');
      }
      if (mPin === fPin) {
        throw new Error('يجب أن يكون رمز الزوج مختلفاً عن رمز الزوجة.');
      }

      const cleanedWheel = wheelSegments
        .filter((w) => w.label.trim().length > 0)
        .map((w, i) => ({
          ...w,
          label: w.label.trim(),
          weight: Math.max(1, Number(w.weight) || 1),
          color: w.color || WHEEL_COLORS[i % WHEEL_COLORS.length],
        }));

      const cleanedRewards = quizRewards
        .filter((r) => r.label.length > 0)
        .map((r) => ({...r}));

      const cleanedCards = mysteryCards
        .filter((c) => c.text.trim().length > 0)
        .map((c) => ({...c, text: c.text.trim()}));

      const clampedMinutes = Math.max(1, Math.min(120, Math.round(Number(reminderMinutes) || 2)));
      const clampedRewardPoints = Math.max(
        1,
        Math.min(50, Math.round(Number(rewardTargetPoints) || 5))
      );

      const nextSettings: EncryptedRoomSettings = {
        ...settings,
        malePasscode: mPin,
        femalePasscode: fPin,
        bannerText: bannerText.trim() || settings.bannerText,
        overlayOpacity,
        backgroundScale,
        backgroundFit,
        allowZoom,
        anniversaryDate: anniversaryDate.trim(),
        upcomingEventDate: upcomingEventDate.trim(),
        upcomingEventTitle: upcomingEventTitle.trim(),
        periodicReminderEnabled: reminderEnabled,
        periodicReminderMinutes: clampedMinutes,
        periodicReminderMessage:
          reminderMessage.trim() ||
          DEFAULT_ROOM_SETTINGS.periodicReminderMessage ||
          '',
        rewardTargetPoints: clampedRewardPoints,
        wheelSegments: cleanedWheel.length > 0 ? cleanedWheel : settings.wheelSegments,
        quizRewards: cleanedRewards.length > 0 ? cleanedRewards : settings.quizRewards,
        mysteryCards:
          cleanedCards.length > 0 ? cleanedCards : DEFAULT_MYSTERY_CARDS,
      };

      await onSaveSettings(nextSettings);
      onPreviewBackgroundControls?.(null);
      setStatusMsg('تمت المزامنة مع الشريك ✅');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'تعذر حفظ الإعدادات.');
    } finally {
      setBusy(false);
    }
  };

  const handleBackgroundFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatusMsg('جاري ضغط الخلفية وتشفيرها ومزامنتها...');
    try {
      const isVideo = file.type.startsWith('video/');
      const isGif = isGifFile(file);
      const mediaType: MediaBackgroundConfig['type'] = isVideo
        ? 'video'
        : isGif
          ? 'gif'
          : 'image';

      await onUpdateBackground(mediaType, file);
      setStatusMsg('تمت المزامنة مع الشريك ✅');
    } catch (err) {
      setStatusMsg(
        err instanceof Error ? err.message : 'تعذر تحميل أو مزامنة ملف الخلفية.'
      );
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const handleBackgroundDirectUrl = async () => {
    const trimmed = bgDirectUrl.trim();
    if (!trimmed) {
      setStatusMsg('يرجى لصق رابط مباشر لصورة أو فيديو أو GIF أولاً.');
      return;
    }
    setBusy(true);
    setStatusMsg('جاري تشفير الرابط ومزامنته مع الشريك...');
    try {
      await onUpdateBackground(bgDirectUrlType, trimmed);
      setBgDirectUrl('');
      setStatusMsg('تمت المزامنة مع الشريك ✅');
    } catch (err) {
      setStatusMsg(
        err instanceof Error ? err.message : 'تعذر حفظ رابط الخلفية.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setStatusMsg('جاري فحص وضغط الصور وتشفيرها للمعرض...');
    try {
      const uploadedInBatch: SharedPhotoItem[] = [];
      let uploadedCount = 0;
      let duplicateFound = false;

      for (const file of Array.from(files)) {
        if (isGifFile(file) && file.size > 1.5 * 1024 * 1024) {
          throw new Error('حجم ملف GIF يتجاوز 1.5 ميجابايت، يرجى اختيار ملف أصغر.');
        }
        const compressed = await compressImageFile(file, 900, 350 * 1024, 0.75);
        const hashes = await computeImageFingerprint(compressed);
        const alreadyExists = await isDuplicatePhoto(compressed, hashes, [
          ...photos,
          ...uploadedInBatch,
        ]);

        if (alreadyExists) {
          duplicateFound = true;
          setDuplicateAlert('تم الرفع من قبل');
          continue;
        }

        await onUploadPhoto(compressed, photoCaption.trim(), hashes);
        uploadedInBatch.push({
          id: `batch_${uploadedCount}`,
          dataUrl: compressed,
          caption: photoCaption.trim(),
          uploadedBy: role,
          createdAt: Date.now(),
          contentHash: hashes.contentHash,
          perceptualHash: hashes.perceptualHash,
        });
        uploadedCount++;
      }

      setPhotoCaption('');
      if (uploadedCount > 0 && !duplicateFound) {
        setStatusMsg('تمت المزامنة مع الشريك ✅');
      } else if (uploadedCount > 0 && duplicateFound) {
        setStatusMsg(`تمت المزامنة مع الشريك ✅ (تم رفع ${uploadedCount} صورة)`);
      } else if (duplicateFound) {
        setStatusMsg('تم الرفع من قبل');
      }
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'تعذر رفع الصورة.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  if (unlocked && livePreviewMode) {
    return (
      <div className="pointer-events-none fixed inset-0 z-50 flex flex-col justify-end p-3">
        <div className="pointer-events-auto mx-auto w-full max-w-md rounded-3xl border border-rose-300/35 bg-[#1a050e]/90 p-3.5 text-rose-50 shadow-2xl backdrop-blur-xl space-y-2.5">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span>ضبط تقريب وإبعاد الخلفية</span>
            <span className="font-mono-num rounded-lg bg-rose-500/25 px-2 py-0.5 text-amber-200">
              {Math.round(backgroundScale * 100)}%
            </span>
          </div>

          <input
            type="range"
            min="0.4"
            max="3"
            step="0.05"
            value={backgroundScale}
            onChange={(e) => updateScale(Number(e.target.value))}
            aria-label="نسبة تقريب أو إبعاد الخلفية"
            className="w-full accent-rose-500"
          />

          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => updateScale(backgroundScale - 0.1)}
              className="flex min-h-[40px] items-center justify-center gap-1 rounded-xl bg-white/10 px-1 text-[11px] font-bold text-white hover:bg-white/20"
            >
              <ZoomOut className="h-3.5 w-3.5" />
              <span>إبعاد</span>
            </button>
            <button
              type="button"
              onClick={() => updateScale(1)}
              className="flex min-h-[40px] items-center justify-center rounded-xl bg-white/10 px-1 text-[11px] font-bold text-amber-200 hover:bg-white/20"
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => updateScale(backgroundScale + 0.1)}
              className="flex min-h-[40px] items-center justify-center gap-1 rounded-xl bg-white/10 px-1 text-[11px] font-bold text-white hover:bg-white/20"
            >
              <ZoomIn className="h-3.5 w-3.5" />
              <span>تقريب</span>
            </button>
            <button
              type="button"
              onClick={() =>
                updateFit(backgroundFit === 'cover' ? 'contain' : 'cover')
              }
              className="flex min-h-[40px] items-center justify-center rounded-xl bg-rose-500/25 px-1 text-[10px] font-bold text-rose-100 hover:bg-rose-500/40"
            >
              {backgroundFit === 'cover' ? 'صورة كاملة' : 'ملء الشاشة'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setLivePreviewMode(false)}
              className="min-h-[40px] rounded-xl bg-white/15 text-xs font-bold text-white hover:bg-white/25"
            >
              رجوع للإعدادات
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await handleSaveGeneralAndLists();
                setLivePreviewMode(false);
              }}
              className="min-h-[40px] rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-xs font-extrabold text-white shadow disabled:opacity-60"
            >
              {busy ? 'جاري الحفظ...' : 'حفظ الحجم'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 transition ${
        unlocked && section === 'background'
          ? 'bg-black/45 backdrop-blur-none'
          : 'bg-black/75 backdrop-blur-md'
      }`}
    >
      <div className="relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-rose-300/30 bg-[#1a050e]/95 text-rose-50 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-300/15 px-4 py-3">
          <h2 className="text-base font-extrabold text-white">الإعدادات المشفرة</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="إغلاق الإعدادات"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-rose-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!unlocked ? (
          <form onSubmit={handleUnlock} className="p-5 space-y-4 text-center">
            <Lock className="mx-auto h-9 w-9 text-rose-400" />
            <p className="text-sm font-bold text-rose-100">
              أدخل رمز الحماية لفتح الإعدادات
            </p>
            <input
              type="password"
              inputMode="numeric"
              dir="ltr"
              value={pinAttempt}
              onChange={(e) => setPinAttempt(e.target.value)}
              placeholder="••••"
              autoFocus
              className="font-mono-num w-full rounded-2xl border border-rose-300/30 bg-black/50 px-4 py-3 text-center text-lg font-bold tracking-[0.4em] text-white focus:border-rose-400 focus:outline-none"
            />
            {pinError && <p className="text-xs font-semibold text-rose-300">{pinError}</p>}
            <button
              type="submit"
              className="w-full min-h-[44px] rounded-2xl bg-rose-600 text-sm font-extrabold text-white hover:bg-rose-500 transition"
            >
              فتح الإعدادات
            </button>
          </form>
        ) : (
          <>
            {/* Section Tabs (max 3 per row for clean mobile readability) */}
            <div className="grid grid-cols-3 gap-1 border-b border-rose-300/15 p-2 bg-black/25">
              {(
                [
                  ['general', 'عام'],
                  ['background', 'الخلفية'],
                  ['wheel', 'العجلة'],
                  ['quiz', 'مسابقة'],
                  ['cards', 'الكروت'],
                  ['photos', 'الصور'],
                ] as Array<[SettingsSection, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={`min-h-[36px] rounded-xl px-1 text-[11px] font-bold transition ${
                    section === id
                      ? 'bg-rose-600 text-white shadow'
                      : 'bg-white/5 text-rose-200 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 inner-scroll p-4 space-y-4">
              {statusMsg && (
                <div className="rounded-xl border border-amber-300/35 bg-amber-500/20 px-3 py-2 text-center text-xs font-bold text-amber-100">
                  {statusMsg}
                </div>
              )}

              {section === 'general' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-rose-200 mb-1">
                      نص الشريط المتحرك العلوي
                    </label>
                    <input
                      type="text"
                      value={bannerText}
                      onChange={(e) => setBannerText(e.target.value)}
                      maxLength={140}
                      className="w-full rounded-xl border border-rose-300/25 bg-black/45 px-3 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-sky-200 mb-1">
                        رمز الزوج (ذكر)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        dir="ltr"
                        maxLength={6}
                        value={malePinDraft}
                        onChange={(e) => setMalePinDraft(e.target.value.replace(/\D/g, ''))}
                        className="font-mono-num w-full rounded-xl border border-sky-300/30 bg-black/45 px-3 py-2 text-center text-xs font-bold text-white focus:border-sky-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-rose-200 mb-1">
                        رمز الزوجة (أنثى)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        dir="ltr"
                        maxLength={6}
                        value={femalePinDraft}
                        onChange={(e) => setFemalePinDraft(e.target.value.replace(/\D/g, ''))}
                        className="font-mono-num w-full rounded-xl border border-rose-300/30 bg-black/45 px-3 py-2 text-center text-xs font-bold text-white focus:border-rose-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Periodic Playtime Reminder Controls */}
                  <div className="rounded-2xl border border-rose-300/20 bg-black/35 p-3 space-y-2.5">
                    <label className="flex items-center justify-between gap-2 cursor-pointer">
                      <span className="flex items-center gap-1.5 text-xs font-extrabold text-amber-200">
                        <BellRing className="h-4 w-4 text-rose-400" />
                        <span>رسالة دورية أثناء اللعب</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={reminderEnabled}
                        onChange={(e) => setReminderEnabled(e.target.checked)}
                        className="h-4 w-4 accent-rose-500"
                      />
                    </label>

                    {reminderEnabled && (
                      <>
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-bold text-rose-200 mb-1">
                            <span>المدة بين كل رسالة (بالدقائق)</span>
                            <span className="font-mono-num text-amber-200">
                              كل {reminderMinutes} د
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={120}
                              dir="ltr"
                              value={reminderMinutes}
                              onChange={(e) =>
                                setReminderMinutes(Math.max(1, Number(e.target.value) || 1))
                              }
                              className="font-mono-num w-16 rounded-xl border border-rose-300/25 bg-black/45 px-2 py-1.5 text-center text-xs font-bold text-white"
                            />
                            <div className="grid flex-1 grid-cols-4 gap-1">
                              {[1, 2, 5, 10].map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setReminderMinutes(m)}
                                  className={`rounded-lg py-1.5 text-[11px] font-bold transition ${
                                    reminderMinutes === m
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-white/10 text-rose-200 hover:bg-white/15'
                                  }`}
                                >
                                  {m}د
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-rose-200 mb-1">
                            نص الرسالة التي ستظهر
                          </label>
                          <input
                            type="text"
                            value={reminderMessage}
                            onChange={(e) => setReminderMessage(e.target.value)}
                            maxLength={140}
                            placeholder="اكتب الرسالة التي ستظهر كل فترة..."
                            className="w-full rounded-xl border border-rose-300/25 bg-black/45 px-3 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Anniversary & Upcoming Special Date */}
                  <div className="rounded-2xl border border-rose-300/20 bg-black/35 p-3 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-200">
                      <CalendarHeart className="h-4 w-4 text-rose-400" />
                      <span>عداد الذكريات والمناسبات</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-rose-200 mb-1">
                        تاريخ بداية ارتباطنا / زواجنا
                      </label>
                      <input
                        type="date"
                        dir="ltr"
                        value={anniversaryDate}
                        onChange={(e) => setAnniversaryDate(e.target.value)}
                        className="font-mono-num w-full rounded-xl border border-rose-300/25 bg-black/45 px-3 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-rose-200 mb-1">
                          مناسبة قادمة (اختياري)
                        </label>
                        <input
                          type="date"
                          dir="ltr"
                          value={upcomingEventDate}
                          onChange={(e) => setUpcomingEventDate(e.target.value)}
                          className="font-mono-num w-full rounded-xl border border-rose-300/25 bg-black/45 px-2 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-rose-200 mb-1">
                          اسم المناسبة
                        </label>
                        <input
                          type="text"
                          value={upcomingEventTitle}
                          onChange={(e) => setUpcomingEventTitle(e.target.value)}
                          placeholder="عيد ميلادك، ذكرى..."
                          maxLength={40}
                          className="w-full rounded-xl border border-rose-300/25 bg-black/45 px-2.5 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Milestone Target Points for Special Reward */}
                  <div className="rounded-2xl border border-rose-300/20 bg-black/35 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-extrabold text-amber-200">
                      <span className="flex items-center gap-1.5">
                        <Gift className="h-4 w-4 text-amber-300" />
                        <span>نقاط طلب المكافأة الخاصة</span>
                      </span>
                      <span className="font-mono-num text-emerald-300">
                        {rewardTargetPoints} نقاط
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={50}
                        dir="ltr"
                        value={rewardTargetPoints}
                        onChange={(e) =>
                          setRewardTargetPoints(
                            Math.max(1, Math.min(50, Number(e.target.value) || 5))
                          )
                        }
                        className="font-mono-num w-16 rounded-xl border border-rose-300/25 bg-black/45 px-2 py-1.5 text-center text-xs font-bold text-white"
                      />
                      <div className="grid flex-1 grid-cols-4 gap-1">
                        {[3, 5, 10, 15].map((pts) => (
                          <button
                            key={pts}
                            type="button"
                            onClick={() => setRewardTargetPoints(pts)}
                            className={`rounded-lg py-1.5 text-[11px] font-bold transition ${
                              rewardTargetPoints === pts
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-white/10 text-rose-200 hover:bg-white/15'
                            }`}
                          >
                            {pts}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Ambient Lounge Audio Section */}
                  <div className="rounded-2xl border border-rose-300/20 bg-black/35 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-extrabold text-amber-200">
                        <Music className="h-4 w-4 text-rose-400" />
                        <span>الأجواء الصوتية (Ambient Audio)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = ambientAudio.toggle();
                          setAmbientPlaying(next);
                        }}
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold transition ${
                          ambientPlaying
                            ? 'bg-emerald-600 text-white shadow'
                            : 'bg-white/10 text-rose-200 hover:bg-white/20'
                        }`}
                      >
                        {ambientPlaying ? 'قيد التشغيل 🎶' : 'تشغيل'}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          ['rain', 'مطر خفيف 🌧️'],
                          ['waves', 'أمواج هادئة 🌊'],
                          ['romantic', 'موسيقى رومانسية 🎹'],
                        ] as Array<[AmbientSoundMode, string]>
                      ).map(([modeId, label]) => (
                        <button
                          key={modeId}
                          type="button"
                          onClick={() => {
                            setAmbientMode(modeId);
                            ambientAudio.setMode(modeId);
                          }}
                          className={`min-h-[38px] rounded-xl px-1.5 py-1 text-[10px] font-bold leading-tight transition ${
                            ambientMode === modeId
                              ? 'bg-rose-600 text-white shadow'
                              : 'bg-white/10 text-rose-200 hover:bg-white/15'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-rose-200 mb-1">
                        <span>مستوى صوت الأجواء الخلفية</span>
                        <span className="font-mono-num text-amber-200">
                          {Math.round(ambientVol * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="1"
                        step="0.05"
                        value={ambientVol}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setAmbientVol(v);
                          ambientAudio.setVolume(v);
                        }}
                        aria-label="مستوى صوت الأجواء الصوتية"
                        className="w-full accent-rose-500"
                      />
                    </div>
                  </div>

                  <label className="flex items-center justify-between rounded-xl border border-rose-300/20 bg-black/30 px-3 py-2.5 cursor-pointer">
                    <span className="text-xs font-bold text-rose-100">
                      السماح بتكبير الشاشة (Pinch Zoom)
                    </span>
                    <input
                      type="checkbox"
                      checked={allowZoom}
                      onChange={(e) => setAllowZoom(e.target.checked)}
                      className="h-4 w-4 accent-rose-500"
                    />
                  </label>

                  {!isInstalled && isInstallable && (
                    <button
                      type="button"
                      onClick={() => install()}
                      className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl bg-white/15 px-3 text-xs font-bold text-white hover:bg-white/25"
                    >
                      <Download className="h-4 w-4" />
                      <span>تثبيت التطبيق على الجهاز (PWA)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      void forceHardUpdateAndReload();
                    }}
                    className="flex w-full min-h-[40px] items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-500/15 px-3 text-xs font-extrabold text-amber-100 hover:bg-amber-500/25 transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>تحديث التطبيق 🔄</span>
                  </button>

                  <button
                    type="button"
                    onClick={onSignOut}
                    className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl border border-rose-400/30 bg-rose-950/60 px-3 text-xs font-bold text-rose-200 hover:bg-rose-900"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>تسجيل الخروج من الجلسة</span>
                  </button>
                </div>
              )}

              {section === 'background' && (
                <div className="space-y-3.5">
                  <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose-300/35 bg-black/35 p-4 text-center cursor-pointer hover:border-rose-400 transition">
                    <Upload className="h-6 w-6 text-rose-400" />
                    <span className="text-xs font-extrabold text-white">
                      اختر صورة، فيديو (حتى 1.5MB)، أو GIF للخلفية
                    </span>
                    <span className="text-[11px] text-rose-200/70">
                      يتم ضغط الصور تلقائياً لأقل من 350 كيلوبايت وتشفيرها للمزامنة الفورية
                    </span>
                    <input
                      type="file"
                      accept="image/*,.gif,video/mp4,video/webm"
                      disabled={busy}
                      onChange={handleBackgroundFile}
                      className="hidden"
                    />
                  </label>

                  {/* Direct Video / GIF / Image URL Paste Input */}
                  <div className="rounded-2xl border border-rose-300/20 bg-black/35 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-rose-200">
                        <Link2 className="h-3.5 w-3.5 text-rose-400" />
                        <span>أو الصق رابط فيديو / GIF مباشر</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setBgDirectUrlType('video')}
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition ${
                            bgDirectUrlType === 'video'
                              ? 'bg-rose-600 text-white'
                              : 'bg-white/10 text-rose-200'
                          }`}
                        >
                          فيديو
                        </button>
                        <button
                          type="button"
                          onClick={() => setBgDirectUrlType('image')}
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition ${
                            bgDirectUrlType === 'image'
                              ? 'bg-rose-600 text-white'
                              : 'bg-white/10 text-rose-200'
                          }`}
                        >
                          صورة / GIF
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="url"
                        dir="ltr"
                        value={bgDirectUrl}
                        onChange={(e) => setBgDirectUrl(e.target.value)}
                        placeholder="https://example.com/background.mp4"
                        className="flex-1 min-w-0 rounded-xl border border-rose-300/25 bg-black/45 px-2.5 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={busy || !bgDirectUrl.trim()}
                        onClick={handleBackgroundDirectUrl}
                        className="shrink-0 min-h-[36px] rounded-xl bg-rose-600 px-3 text-xs font-extrabold text-white hover:bg-rose-500 disabled:opacity-50 transition"
                      >
                        تطبيق
                      </button>
                    </div>
                  </div>

                  {/* Background Zoom In / Zoom Out Controls */}
                  <div className="rounded-2xl border border-rose-300/20 bg-black/35 p-3 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-rose-200">
                      <span>حجم الخلفية (تقريب / إبعاد)</span>
                      <span className="font-mono-num rounded-md bg-rose-500/20 px-2 py-0.5 text-amber-200">
                        {Math.round(backgroundScale * 100)}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0.4"
                      max="3"
                      step="0.05"
                      value={backgroundScale}
                      onChange={(e) => updateScale(Number(e.target.value))}
                      aria-label="تقريب أو إبعاد صورة الخلفية"
                      className="w-full accent-rose-500"
                    />

                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateScale(backgroundScale - 0.1)}
                        className="flex min-h-[38px] items-center justify-center gap-1 rounded-xl bg-white/10 px-1 text-[11px] font-bold text-white hover:bg-white/20"
                      >
                        <ZoomOut className="h-3.5 w-3.5" />
                        <span>إبعاد</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateScale(1)}
                        className="flex min-h-[38px] items-center justify-center rounded-xl bg-white/10 px-1 text-[11px] font-bold text-amber-200 hover:bg-white/20"
                      >
                        100%
                      </button>
                      <button
                        type="button"
                        onClick={() => updateScale(backgroundScale + 0.1)}
                        className="flex min-h-[38px] items-center justify-center gap-1 rounded-xl bg-white/10 px-1 text-[11px] font-bold text-white hover:bg-white/20"
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                        <span>تقريب</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLivePreviewMode(true)}
                        className="flex min-h-[38px] items-center justify-center gap-1 rounded-xl bg-rose-600/80 px-1 text-[11px] font-bold text-white hover:bg-rose-500"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>معاينة</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => updateFit('cover')}
                        className={`min-h-[36px] rounded-xl text-[11px] font-bold transition ${
                          backgroundFit === 'cover'
                            ? 'bg-rose-600 text-white shadow'
                            : 'bg-white/10 text-rose-200 hover:bg-white/15'
                        }`}
                      >
                        ملء الشاشة
                      </button>
                      <button
                        type="button"
                        onClick={() => updateFit('contain')}
                        className={`min-h-[36px] rounded-xl text-[11px] font-bold transition ${
                          backgroundFit === 'contain'
                            ? 'bg-rose-600 text-white shadow'
                            : 'bg-white/10 text-rose-200 hover:bg-white/15'
                        }`}
                      >
                        إظهار الصورة كاملة
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-rose-200 mb-1">
                      <span>درجة وضوح الخلفية (العتامة)</span>
                      <span className="font-mono-num">
                        {Math.round(overlayOpacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.05"
                      value={overlayOpacity}
                      onChange={(e) => updateOpacity(Number(e.target.value))}
                      className="w-full accent-rose-500"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setStatusMsg(null);
                      try {
                        setBackgroundScale(1);
                        setBackgroundFit('cover');
                        onPreviewBackgroundControls?.(null);
                        await onUpdateBackground('default');
                        setStatusMsg('تمت المزامنة مع الشريك ✅');
                      } catch (err) {
                        setStatusMsg(
                          err instanceof Error
                            ? err.message
                            : 'تعذر استعادة الخلفية الافتراضية.'
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-white/10 text-xs font-bold text-rose-100 hover:bg-white/20 disabled:opacity-60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>استعادة الخلفية الرومانسية الافتراضية</span>
                  </button>
                </div>
              )}

              {section === 'wheel' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-200">
                      خيارات العجلة وأوزان الاحتمالية
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setWheelSegments((prev) => [
                          ...prev,
                          {
                            id: `w_${Date.now()}`,
                            label: 'خيار جديد',
                            weight: 10,
                            color: WHEEL_COLORS[prev.length % WHEEL_COLORS.length],
                          },
                        ])
                      }
                      className="flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>إضافة</span>
                    </button>
                  </div>

                  {wheelSegments.map((seg, idx) => (
                    <div
                      key={seg.id}
                      className="flex items-center gap-1.5 rounded-xl border border-rose-300/20 bg-black/35 p-2"
                    >
                      <input
                        type="color"
                        value={seg.color}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWheelSegments((prev) =>
                            prev.map((item, i) =>
                              i === idx ? {...item, color: val} : item
                            )
                          );
                        }}
                        className="h-8 w-8 shrink-0 rounded-lg bg-transparent border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={seg.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWheelSegments((prev) =>
                            prev.map((item, i) =>
                              i === idx ? {...item, label: val} : item
                            )
                          );
                        }}
                        className="flex-1 min-w-0 rounded-lg border border-rose-300/20 bg-black/45 px-2 py-1.5 text-xs text-white"
                      />
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={seg.weight}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setWheelSegments((prev) =>
                            prev.map((item, i) =>
                              i === idx ? {...item, weight: val} : item
                            )
                          );
                        }}
                        title="الوزن الاحتمالي"
                        className="font-mono-num w-14 rounded-lg border border-rose-300/20 bg-black/45 px-1.5 py-1.5 text-center text-xs text-amber-200"
                      />
                      <button
                        type="button"
                        disabled={wheelSegments.length <= 2}
                        onClick={() =>
                          setWheelSegments((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-900/60 text-rose-200 hover:bg-rose-700 disabled:opacity-35"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {section === 'quiz' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-200">
                      أزرار مكافآت / عقوبات نهاية المسابقة
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuizRewards((prev) => [
                          ...prev,
                          {id: `r_${Date.now()}`, label: 'خيار جديد'},
                        ])
                      }
                      className="flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>إضافة</span>
                    </button>
                  </div>

                  {quizRewards.map((btn, idx) => (
                    <div
                      key={btn.id}
                      className="flex items-center gap-2 rounded-xl border border-rose-300/20 bg-black/35 p-2"
                    >
                      <input
                        type="text"
                        value={btn.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuizRewards((prev) =>
                            prev.map((item, i) =>
                              i === idx ? {...item, label: val} : item
                            )
                          );
                        }}
                        className="flex-1 rounded-lg border border-rose-300/20 bg-black/45 px-2.5 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        disabled={quizRewards.length <= 1}
                        onClick={() =>
                          setQuizRewards((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-900/60 text-rose-200 hover:bg-rose-700 disabled:opacity-35"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={async () => {
                      await onSaveSettings({...settings, askedQuestionIds: []});
                      setStatusMsg('تمت إعادة تصفير سجل الأسئلة المطروحة.');
                    }}
                    className="flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-white/10 text-xs font-bold text-rose-100 hover:bg-white/20"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>تصفير سجل الأسئلة المستخدمة ({settings.askedQuestionIds.length})</span>
                  </button>
                </div>
              )}

              {section === 'cards' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-200">
                      نصوص كروت المفاجآت اليومية
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMysteryCards((prev) => [
                          ...prev,
                          {id: `c_${Date.now()}`, text: 'مفاجأة جديدة ❤️'},
                        ])
                      }
                      className="flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>إضافة كارت</span>
                    </button>
                  </div>

                  {mysteryCards.map((card, idx) => (
                    <div
                      key={card.id}
                      className="flex items-center gap-2 rounded-xl border border-rose-300/20 bg-black/35 p-2"
                    >
                      <input
                        type="text"
                        value={card.text}
                        maxLength={70}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMysteryCards((prev) =>
                            prev.map((item, i) =>
                              i === idx ? {...item, text: val} : item
                            )
                          );
                        }}
                        className="flex-1 rounded-lg border border-rose-300/20 bg-black/45 px-2.5 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        disabled={mysteryCards.length <= 1}
                        onClick={() =>
                          setMysteryCards((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-900/60 text-rose-200 hover:bg-rose-700 disabled:opacity-35"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setMysteryCards(DEFAULT_MYSTERY_CARDS)}
                    className="flex w-full min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-white/10 text-xs font-bold text-rose-100 hover:bg-white/20"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>استعادة الكروت الافتراضية</span>
                  </button>
                </div>
              )}

              {section === 'photos' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    placeholder="تعليق اختياري للصورة قبل الرفع..."
                    maxLength={80}
                    className="w-full rounded-xl border border-rose-300/25 bg-black/45 px-3 py-2 text-xs text-white"
                  />

                  <label className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-rose-300/35 bg-black/35 p-4 text-center cursor-pointer hover:border-rose-400">
                    <ImageIcon className="h-6 w-6 text-rose-400" />
                    <span className="text-xs font-extrabold text-white">
                      رفع صور دائمة للمعرض المشترك
                    </span>
                    <input
                      type="file"
                      accept="image/*,.gif"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((p) => (
                      <div
                        key={p.id}
                        className="relative aspect-square overflow-hidden rounded-xl border border-rose-300/25"
                      >
                        <img
                          src={p.dataUrl}
                          alt={p.caption || 'صورة'}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => onDeletePhoto(p.id)}
                          aria-label="حذف الصورة من الإعدادات"
                          className="absolute top-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-rose-300 hover:bg-rose-600 hover:text-white"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Save Footer for General/Wheel/Quiz/Overlay */}
            {section !== 'photos' && (
              <div className="border-t border-rose-300/15 p-3 bg-black/30">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSaveGeneralAndLists}
                  className="w-full min-h-[44px] rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 text-sm font-extrabold text-white shadow-lg hover:from-rose-500 hover:to-rose-400 disabled:opacity-60 transition"
                >
                  {busy ? 'جاري التشفير والحفظ...' : 'حفظ ومزامنة الإعدادات'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Duplicate Photo Alert Modal with Close Button */}
      {duplicateAlert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-3xl border border-amber-300/45 bg-[#240612] p-5 text-center text-white shadow-2xl space-y-3">
            <AlertCircle className="mx-auto h-10 w-10 text-amber-300" />
            <h3 className="text-base font-extrabold text-amber-200">
              {duplicateAlert}
            </h3>
            <p className="text-xs text-rose-100/90 leading-relaxed">
              هذه الصورة موجودة بالفعل في المعرض المشترك، لا حاجة لتكرار رفعها.
            </p>
            <button
              type="button"
              onClick={() => setDuplicateAlert(null)}
              className="w-full min-h-[42px] rounded-2xl bg-rose-600 text-sm font-extrabold text-white shadow hover:bg-rose-500 transition"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
