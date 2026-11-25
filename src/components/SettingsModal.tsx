import React, {useState} from 'react';
import {
  Download,
  Image as ImageIcon,
  Lock,
  LogOut,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  EncryptedRoomSettings,
  MediaBackgroundConfig,
  QuizRewardButton,
  SharedPhotoItem,
  WheelSegment,
} from '../types/app';
import {compressImageFile, fileToDataUrl} from '../services/mediaStore';
import {usePWAInstall} from '../hooks/usePWAInstall';

type SettingsSection = 'general' | 'background' | 'wheel' | 'quiz' | 'photos';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPin: string;
  settings: EncryptedRoomSettings;
  photos: SharedPhotoItem[];
  onSaveSettings: (next: EncryptedRoomSettings) => Promise<void>;
  onChangePasscode: (newPin: string, nextSettings: EncryptedRoomSettings) => Promise<void>;
  onUpdateBackground: (
    type: MediaBackgroundConfig['type'],
    dataUrl: string,
    isSyncedMedia: boolean
  ) => Promise<void>;
  onUploadPhoto: (dataUrl: string, caption: string) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onSignOut: () => Promise<void>;
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
  settings,
  photos,
  onSaveSettings,
  onChangePasscode,
  onUpdateBackground,
  onUploadPhoto,
  onDeletePhoto,
  onSignOut,
}) => {
  const [unlocked, setUnlocked] = useState(false);
  const [pinAttempt, setPinAttempt] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [section, setSection] = useState<SettingsSection>('general');

  // Editable drafts
  const [newPin, setNewPin] = useState('');
  const [bannerText, setBannerText] = useState(settings.bannerText);
  const [overlayOpacity, setOverlayOpacity] = useState(settings.overlayOpacity);
  const [allowZoom, setAllowZoom] = useState(settings.allowZoom);
  const [wheelSegments, setWheelSegments] = useState<WheelSegment[]>(settings.wheelSegments);
  const [quizRewards, setQuizRewards] = useState<QuizRewardButton[]>(settings.quizRewards);
  const [photoCaption, setPhotoCaption] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const {isInstallable, isInstalled, install} = usePWAInstall();

  if (!isOpen) return null;

  const handleClose = () => {
    setUnlocked(false);
    setPinAttempt('');
    setPinError(null);
    setStatusMsg(null);
    onClose();
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinAttempt.trim() === currentPin) {
      setUnlocked(true);
      setPinError(null);
      setBannerText(settings.bannerText);
      setOverlayOpacity(settings.overlayOpacity);
      setAllowZoom(settings.allowZoom);
      setWheelSegments(settings.wheelSegments);
      setQuizRewards(settings.quizRewards);
      setNewPin('');
    } else {
      setPinError('الرمز السري غير صحيح.');
    }
  };

  const handleSaveGeneralAndLists = async () => {
    setBusy(true);
    setStatusMsg(null);
    try {
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

      const nextSettings: EncryptedRoomSettings = {
        ...settings,
        bannerText: bannerText.trim() || settings.bannerText,
        overlayOpacity,
        allowZoom,
        wheelSegments: cleanedWheel.length > 0 ? cleanedWheel : settings.wheelSegments,
        quizRewards: cleanedRewards.length > 0 ? cleanedRewards : settings.quizRewards,
      };

      const trimmedPin = newPin.trim();
      if (trimmedPin.length > 0) {
        if (trimmedPin.length < 4 || !/^\d+$/.test(trimmedPin)) {
          throw new Error('يجب أن يتكون الرمز الجديد من 4 أرقام على الأقل.');
        }
        await onChangePasscode(trimmedPin, nextSettings);
        setNewPin('');
        setStatusMsg('تم تحديث الرمز السري وإعادة تشفير الغرفة بالكامل.');
      } else {
        await onSaveSettings(nextSettings);
        setStatusMsg('تم حفظ الإعدادات وتشفيرها بنجاح.');
      }
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
    setStatusMsg(null);
    try {
      const isVideo = file.type.startsWith('video/');
      const isGif = file.type === 'image/gif';

      if (isVideo) {
        const dataUrl = await fileToDataUrl(file);
        await onUpdateBackground('video', dataUrl, false);
        setStatusMsg('تم تعيين الفيديو كخلفية متحركة بنجاح.');
      } else if (isGif) {
        const dataUrl = await fileToDataUrl(file);
        const canSync = dataUrl.length < 600000;
        await onUpdateBackground('gif', dataUrl, canSync);
        setStatusMsg(
          canSync
            ? 'تم تعيين ومزامنة خلفية GIF بنجاح.'
            : 'تم حفظ خلفية GIF محلياً بجودة كاملة.'
        );
      } else {
        const compressed = await compressImageFile(file, 1280, 420000);
        await onUpdateBackground('image', compressed, true);
        setStatusMsg('تم تحديث ومزامنة صورة الخلفية بنجاح.');
      }
    } catch {
      setStatusMsg('تعذر تحميل ملف الخلفية.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      for (const file of Array.from(files)) {
        const compressed = await compressImageFile(file, 960, 400000);
        await onUploadPhoto(compressed, photoCaption.trim());
      }
      setPhotoCaption('');
      setStatusMsg('تم تشفير ورفع الصور إلى المعرض الدائم ومزامنتها.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'تعذر رفع الصورة.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-md">
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
            {/* Section Tabs (max 4 in row, clean wrap for 5th) */}
            <div className="grid grid-cols-5 gap-1 border-b border-rose-300/15 p-2 bg-black/25">
              {(
                [
                  ['general', 'عام'],
                  ['background', 'الخلفية'],
                  ['wheel', 'العجلة'],
                  ['quiz', 'مسابقة'],
                  ['photos', 'الصور'],
                ] as Array<[SettingsSection, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={`min-h-[38px] rounded-xl px-1 text-[11px] font-bold transition ${
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

                  <div>
                    <label className="block text-xs font-bold text-rose-200 mb-1">
                      تغيير الرمز السري الرئيسي (اختياري)
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      dir="ltr"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="اتركه فارغاً للإبقاء على الرمز الحالي"
                      className="font-mono-num w-full rounded-xl border border-rose-300/25 bg-black/45 px-3 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
                    />
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
                  <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose-300/35 bg-black/35 p-5 text-center cursor-pointer hover:border-rose-400 transition">
                    <Upload className="h-7 w-7 text-rose-400" />
                    <span className="text-xs font-extrabold text-white">
                      اختر صورة، فيديو (MP4/WebM)، أو GIF للخلفية
                    </span>
                    <span className="text-[11px] text-rose-200/70">
                      تظهر الخلفية بوضوح خلف الواجهة مع تعتيم قابل للتعديل
                    </span>
                    <input
                      type="file"
                      accept="image/*,video/mp4,video/webm"
                      onChange={handleBackgroundFile}
                      className="hidden"
                    />
                  </label>

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
                      onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                      className="w-full accent-rose-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onUpdateBackground('default', '', true)}
                    className="flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-white/10 text-xs font-bold text-rose-100 hover:bg-white/20"
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
                      accept="image/*"
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
    </div>
  );
};
