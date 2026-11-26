import React, {useState} from 'react';
import {Copy, Download, HeartHandshake, Send, ShieldCheck, Smartphone} from 'lucide-react';
import {PartnerPresenceData, PartnerRole, ReactionEvent} from '../types/app';
import {usePWAInstall} from '../hooks/usePWAInstall';
import {soundEngine} from '../services/sound';

interface PartnerSyncTabProps {
  role: PartnerRole;
  roomId: string;
  malePresence: PartnerPresenceData | null;
  femalePresence: PartnerPresenceData | null;
  onSendKissPing: (event: ReactionEvent, note: string) => Promise<void>;
  onAfterSend?: () => void;
}

function formatLastSeen(ts?: number): string {
  if (!ts) return 'لم يتصل بعد';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 45) return 'متصل الآن';
  if (diffSec < 3600) return `منذ ${Math.floor(diffSec / 60)} دقيقة`;
  return `منذ ${Math.floor(diffSec / 3600)} ساعة`;
}

export const PartnerSyncTab: React.FC<PartnerSyncTabProps> = ({
  role,
  roomId,
  malePresence,
  femalePresence,
  onSendKissPing,
  onAfterSend,
}) => {
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();

  const handleCopyRoom = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard restriction
    }
  };

  const handleSendPing = async () => {
    soundEngine.playKissPing();
    const text = note.trim() || (role === 'male' ? 'أحبكِ ❤️💋' : 'أحبكَ ❤️💋');
    setNote('');
    await onSendKissPing(
      {
        id: `kiss_${Date.now()}`,
        type: 'kiss',
        source: 'ping',
        triggeredBy: role,
        label: text,
        timestamp: Date.now(),
      },
      text
    );
    onAfterSend?.();
  };

  const partnerData = role === 'male' ? femalePresence : malePresence;
  const partnerOnline =
    Boolean(partnerData?.online) &&
    Boolean(partnerData?.lastSeen) &&
    Date.now() - (partnerData?.lastSeen || 0) < 90000;

  return (
    <div className="flex h-full w-full flex-col justify-between gap-2.5 py-1 inner-scroll">
      {/* Live Presence Cards */}
      <div className="grid grid-cols-2 gap-2.5 [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">
        <div className="rounded-2xl border border-sky-300/30 bg-sky-950/20 p-3 text-center backdrop-blur-[2px]">
          <div className="text-2xl mb-1">👨🏻</div>
          <p className="text-xs font-extrabold text-white">الذكر (الحبيب)</p>
          <p
            className={`mt-1 text-[11px] font-bold ${
              malePresence?.online && Date.now() - (malePresence.lastSeen || 0) < 90000
                ? 'text-emerald-300'
                : 'text-sky-100'
            }`}
          >
            {formatLastSeen(malePresence?.lastSeen)}
          </p>
        </div>

        <div className="rounded-2xl border border-rose-300/30 bg-rose-950/20 p-3 text-center backdrop-blur-[2px]">
          <div className="text-2xl mb-1">👩🏻</div>
          <p className="text-xs font-extrabold text-white">الأنثى (الحبيبة)</p>
          <p
            className={`mt-1 text-[11px] font-bold ${
              femalePresence?.online &&
              Date.now() - (femalePresence.lastSeen || 0) < 90000
                ? 'text-emerald-300'
                : 'text-rose-100'
            }`}
          >
            {formatLastSeen(femalePresence?.lastSeen)}
          </p>
        </div>
      </div>

      {/* Send Instant Kiss & Romantic Ping */}
      <div className="rounded-2xl border border-rose-200/25 bg-black/20 p-3 space-y-2.5 backdrop-blur-[2px] [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-rose-100">
            <HeartHandshake className="h-4 w-4 text-rose-400" />
            <span>إرسال نبضة حب فورية لشريكك</span>
          </span>
          <span className="text-[11px] text-rose-200/75">
            {partnerOnline ? 'متصل الآن' : 'في الانتظار'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={90}
            placeholder="اكتب همسة سريعة أو أرسل قبلة مباشرة..."
            className="flex-1 min-h-[42px] rounded-xl border border-rose-300/25 bg-black/45 px-3 text-xs text-white focus:border-rose-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSendPing}
            className="flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 text-xs font-extrabold text-white hover:bg-rose-500 active:scale-95 transition"
          >
            <Send className="h-3.5 w-3.5" />
            <span>إرسال</span>
          </button>
        </div>

        {partnerData?.pingMessage && (
          <div className="rounded-xl border border-rose-300/20 bg-rose-900/40 px-3 py-2 text-xs text-rose-100">
            آخر رسالة من شريكك: <strong className="text-amber-200">{partnerData.pingMessage}</strong>
          </div>
        )}
      </div>

      {/* Room Encryption & PWA Install */}
      <div className="rounded-2xl border border-rose-200/25 bg-black/20 p-3 space-y-2 mt-auto backdrop-blur-[2px] [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-300 font-bold">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>تشفير AES-256 نشط</span>
          </span>
          <button
            type="button"
            onClick={handleCopyRoom}
            className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-rose-100 hover:bg-white/20"
          >
            <Copy className="h-3 w-3" />
            <span>{copied ? 'تم النسخ!' : `الغرفة: ${roomId}`}</span>
          </button>
        </div>

        {!isInstalled && (isInstallable || isIOS) && (
          <button
            type="button"
            onClick={() => (isInstallable ? install() : setShowIOSGuide(true))}
            className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/25 transition"
          >
            {isIOS ? <Smartphone className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            <span>تثبيت التطبيق على الهاتف (PWA)</span>
          </button>
        )}
      </div>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-rose-300/30 bg-[#1d0610] p-5 text-center text-white">
            <h3 className="text-base font-extrabold mb-2">التثبيت على iPhone / iPad</h3>
            <p className="text-xs text-rose-100/90 leading-relaxed mb-4">
              1. اضغط على زر المشاركة (Share) في شريط Safari.
              <br />
              2. اختر &quot;إضافة إلى الشاشة الرئيسية&quot; (Add to Home Screen).
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full min-h-[42px] rounded-xl bg-rose-600 text-xs font-bold text-white"
            >
              حسناً
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
