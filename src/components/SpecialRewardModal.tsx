import React, {useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {Gift, Heart, Send, Sparkles, X} from 'lucide-react';
import {PartnerRole, SpecialRewardRequest} from '../types/app';

const QUICK_REWARD_PRESETS = [
  'تدليك مريح 15 دقيقة 💆🏻',
  'عشاء مفاجئ على ذوقي 🍽️',
  'خروجة رومانسية خاصة ✨',
  'تحقيق أي أمنية اليوم بدون نقاش 🎁',
  'قهوة وحلوى على السرير ☕',
];

interface SpecialRewardModalProps {
  isOpen: boolean;
  role: PartnerRole;
  myPoints: number;
  targetPoints: number;
  onClose: () => void;
  onSubmitRequest: (rewardText: string, deductPoints: boolean) => Promise<void>;
}

export const SpecialRewardModal: React.FC<SpecialRewardModalProps> = ({
  isOpen,
  role,
  myPoints,
  targetPoints,
  onClose,
  onSubmitRequest,
}) => {
  const [rewardText, setRewardText] = useState('');
  const [deductPoints, setDeductPoints] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = rewardText.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await onSubmitRequest(text, deductPoints);
      setRewardText('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-3xl border border-amber-300/45 bg-[#1e0611]/95 p-4 text-white shadow-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-rose-300/15 pb-2">
          <div className="flex items-center gap-1.5 text-sm font-extrabold text-amber-200">
            <Gift className="h-4 w-4 text-amber-300" />
            <span>اطلب مكافأة خاصة ({role === 'male' ? 'الزوج' : 'الزوجة'})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-rose-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-center text-xs font-bold text-rose-100">
          نقاطك الحالية:{' '}
          <span className="font-mono-num text-amber-300">{myPoints}</span> /{' '}
          <span className="font-mono-num text-emerald-300">{targetPoints}</span> ✨
        </p>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_REWARD_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setRewardText(preset)}
              className={`rounded-xl border px-2.5 py-1 text-[11px] font-bold transition ${
                rewardText === preset
                  ? 'border-amber-300 bg-rose-600 text-white'
                  : 'border-rose-300/25 bg-white/10 text-rose-100 hover:bg-white/20'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input
            type="text"
            value={rewardText}
            onChange={(e) => setRewardText(e.target.value)}
            maxLength={90}
            placeholder="أو اكتب المكافأة الخاصة التي تريدها..."
            className="w-full rounded-xl border border-rose-300/30 bg-black/50 px-3 py-2.5 text-xs text-white focus:border-amber-300 focus:outline-none"
          />

          <label className="flex items-center justify-between rounded-xl border border-rose-300/20 bg-black/35 px-3 py-2 text-[11px] font-bold text-rose-100 cursor-pointer">
            <span>استبدال وخصم {targetPoints} نقاط عند الطلب</span>
            <input
              type="checkbox"
              checked={deductPoints}
              onChange={(e) => setDeductPoints(e.target.checked)}
              className="h-4 w-4 accent-amber-400"
            />
          </label>

          <button
            type="submit"
            disabled={!rewardText.trim() || busy}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 text-xs sm:text-sm font-extrabold text-white shadow-lg hover:from-amber-400 hover:to-rose-500 disabled:opacity-50 transition"
          >
            <Send className="h-4 w-4" />
            <span>{busy ? 'جاري الإرسال...' : 'إرسال طلب المكافأة للشريك'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

interface PartnerRewardAlertOverlayProps {
  request: SpecialRewardRequest | null | undefined;
  myRole: PartnerRole;
  onAcknowledge: () => Promise<void>;
}

export const PartnerRewardAlertOverlay: React.FC<PartnerRewardAlertOverlayProps> = ({
  request,
  myRole,
  onAcknowledge,
}) => {
  const [busy, setBusy] = useState(false);

  const shouldShow = Boolean(
    request && request.status === 'pending' && request.requestedBy !== myRole
  );

  return (
    <AnimatePresence>
      {shouldShow && request && (
        <motion.div
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          className="fixed inset-0 z-[72] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{scale: 0.8, y: 18, opacity: 0}}
            animate={{scale: 1, y: 0, opacity: 1}}
            exit={{scale: 0.85, opacity: 0}}
            className="w-full max-w-sm rounded-3xl border-2 border-amber-300/70 bg-gradient-to-br from-[#2a0716] via-rose-950 to-[#19040d] p-5 text-center text-white shadow-[0_0_50px_rgba(251,191,36,0.35)] space-y-3"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/20 border border-amber-300/50 animate-bounce">
              <Gift className="h-7 w-7 text-amber-300" />
            </div>

            <div className="flex items-center justify-center gap-1 text-xs font-extrabold text-amber-200">
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                طلب مكافأة خاصة من{' '}
                {request.requestedBy === 'male' ? 'الزوج 👨🏻' : 'الزوجة 👩🏻'}
              </span>
            </div>

            <div className="rounded-2xl border border-amber-300/35 bg-black/45 px-4 py-4 text-base sm:text-lg font-extrabold text-amber-100 shadow-inner">
              {request.rewardText}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onAcknowledge();
                } finally {
                  setBusy(false);
                }
              }}
              className="flex w-full min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-rose-600 text-sm font-extrabold text-white shadow-lg hover:from-emerald-500 hover:to-rose-500 active:scale-95 transition disabled:opacity-60"
            >
              <Heart className="h-4 w-4 fill-current" />
              <span>{busy ? 'جاري التأكيد...' : 'موافق / سأنفذها فوراً ❤️'}</span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
