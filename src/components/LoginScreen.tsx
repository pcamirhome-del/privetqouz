import React, {useState} from 'react';
import {motion} from 'motion/react';
import {Delete, Heart, Lock, ShieldCheck} from 'lucide-react';
import {PartnerRole} from '../types/app';
import {RomanticFloatingLayer} from './RomanticFloatingLayer';

interface LoginScreenProps {
  onAuthenticateRoom: (roomId: string, pin: string, role: PartnerRole) => Promise<void>;
  defaultRoomId: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onAuthenticateRoom,
  defaultRoomId,
}) => {
  const [step, setStep] = useState<'pin' | 'gender'>('pin');
  const [pin, setPin] = useState('');
  const [roomId, setRoomId] = useState(defaultRoomId);
  const [showRoomEdit, setShowRoomEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleDigit = (digit: string) => {
    setError(null);
    if (pin.length >= 6) return;
    setPin((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setError(null);
    setPin((p) => p.slice(0, -1));
  };

  const handlePinContinue = () => {
    if (pin.length < 4) {
      setError('أدخل رمز الدخول المكون من 4 أرقام على الأقل (الافتراضي 0000).');
      return;
    }
    setError(null);
    setStep('gender');
  };

  const handleSelectRole = async (role: PartnerRole) => {
    setBusy(true);
    setError(null);
    try {
      await onAuthenticateRoom(roomId, pin, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الدخول إلى الغرفة.');
      setStep('pin');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex h-[100dvh] w-screen flex-col items-center justify-center overflow-hidden bg-[#140309] px-4 py-3 text-rose-50">
      <img
        src="/src/assets/images/default_romantic_bg_1795637641791.jpg"
        alt="خلفية رومانسية"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-55"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1a040c]/80 via-[#1f0610]/70 to-[#110207]/90" />

      <RomanticFloatingLayer density="normal" />

      <motion.div
        initial={{opacity: 0, y: 14, scale: 0.97}}
        animate={{opacity: 1, y: 0, scale: 1}}
        transition={{duration: 0.35}}
        className="relative z-20 w-full max-w-sm rounded-3xl border border-rose-400/25 bg-rose-950/60 p-4 sm:p-5 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
      >
        <div className="flex flex-col items-center text-center mb-3">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 shadow-lg shadow-rose-900/50">
            <Heart className="h-6 w-6 text-white fill-white/90" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">
            نبض القلوب
          </h1>
          <p className="mt-0.5 text-xs text-rose-200/80">
            مساحتنا المشفرة للمرح والمزامنة اللحظية
          </p>
        </div>

        {/* Encrypted Room Selector */}
        <div className="mb-3 rounded-2xl border border-rose-300/15 bg-black/30 p-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-300 font-semibold truncate">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span className="truncate">مزامنة مشفرة جاهزة</span>
            </div>
            <button
              type="button"
              onClick={() => setShowRoomEdit((v) => !v)}
              className="shrink-0 rounded-lg bg-rose-500/20 px-2 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/30"
            >
              رمز الغرفة
            </button>
          </div>

          {showRoomEdit && (
            <div className="mt-2 pt-2 border-t border-rose-400/15">
              <label className="block text-[11px] text-rose-200/80 mb-1">
                معرّف الغرفة المشترك بينكما (نفس الكود لدى الشريكين):
              </label>
              <input
                type="text"
                dir="ltr"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="habibi-room"
                className="w-full rounded-xl border border-rose-300/25 bg-black/45 px-3 py-1.5 text-xs text-white focus:border-rose-400 focus:outline-none"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-rose-400/40 bg-rose-900/70 px-3 py-2 text-center text-xs font-medium text-rose-100">
            {error}
          </div>
        )}

        {step === 'pin' ? (
          <div>
            {/* PIN Dots */}
            <div className="mb-3 flex items-center justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full border transition-all ${
                    pin.length > i
                      ? 'scale-110 border-rose-300 bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.8)]'
                      : 'border-rose-300/40 bg-white/5'
                  }`}
                />
              ))}
              {pin.length > 4 && (
                <span className="font-mono-num text-xs text-rose-200">
                  +{pin.length - 4}
                </span>
              )}
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2" dir="ltr">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDigit(d)}
                  className="font-mono-num min-h-[46px] rounded-2xl border border-rose-300/15 bg-white/10 text-lg font-bold text-white hover:bg-rose-500/25 active:scale-95 transition"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPin('');
                  setError(null);
                }}
                className="min-h-[46px] rounded-2xl border border-rose-300/15 bg-white/5 text-xs font-semibold text-rose-200 hover:bg-white/15 active:scale-95 transition"
              >
                مسح
              </button>
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="font-mono-num min-h-[46px] rounded-2xl border border-rose-300/15 bg-white/10 text-lg font-bold text-white hover:bg-rose-500/25 active:scale-95 transition"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                aria-label="حذف رقم"
                className="flex min-h-[46px] items-center justify-center rounded-2xl border border-rose-300/15 bg-white/5 text-rose-200 hover:bg-white/15 active:scale-95 transition"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handlePinContinue}
              className="mt-3 flex w-full min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-900/50 hover:from-rose-500 hover:to-rose-400 active:scale-[0.98] transition"
            >
              <Lock className="h-4 w-4" />
              <span>دخول (الرمز الافتراضي 0000)</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm font-bold text-rose-100">
              اختر صفتك في هذه الجلسة للمزامنة:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSelectRole('male')}
                className="flex flex-col items-center justify-center gap-2 min-h-[112px] rounded-2xl border border-sky-400/35 bg-sky-950/45 p-4 text-white hover:bg-sky-800/45 active:scale-95 transition disabled:opacity-50"
              >
                <span className="text-3xl">👨🏻</span>
                <span className="text-base font-extrabold">ذكر</span>
                <span className="text-[11px] text-sky-200/80">الحبيب</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => handleSelectRole('female')}
                className="flex flex-col items-center justify-center gap-2 min-h-[112px] rounded-2xl border border-rose-400/40 bg-rose-900/45 p-4 text-white hover:bg-rose-700/50 active:scale-95 transition disabled:opacity-50"
              >
                <span className="text-3xl">👩🏻</span>
                <span className="text-base font-extrabold">أنثى</span>
                <span className="text-[11px] text-rose-200/80">الحبيبة</span>
              </button>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep('pin')}
              className="w-full min-h-[40px] rounded-xl text-xs font-semibold text-rose-200/80 hover:text-white"
            >
              {busy ? 'جاري التحقق والتشفير...' : 'العودة لإدخال الرمز'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
