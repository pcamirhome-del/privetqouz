import React, {useEffect, useMemo, useRef, useState} from 'react';
import confetti from 'canvas-confetti';
import {AnimatePresence, motion} from 'motion/react';
import {Check, RotateCw, X} from 'lucide-react';
import {PartnerRole, WheelLiveState, WheelSegment} from '../types/app';
import {soundEngine} from '../services/sound';

interface SpinWheelTabProps {
  role: PartnerRole;
  segments: WheelSegment[];
  wheelState: WheelLiveState | null;
  onUpdateWheel: (next: WheelLiveState) => Promise<void>;
}

function pickWeightedIndex(segments: WheelSegment[]): number {
  const total = segments.reduce((acc, s) => acc + Math.max(0.1, s.weight), 0);
  let r = Math.random() * total;
  for (let i = 0; i < segments.length; i++) {
    r -= Math.max(0.1, segments[i].weight);
    if (r <= 0) return i;
  }
  return segments.length - 1;
}

export const SpinWheelTab: React.FC<SpinWheelTabProps> = ({
  role,
  segments,
  wheelState,
  onUpdateWheel,
}) => {
  const [rotation, setRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const lastSpinIdRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const currentRotRef = useRef(0);

  const safeSegments = useMemo(
    () =>
      segments.length > 0
        ? segments
        : [{id: 'default', label: 'مم', weight: 10, color: '#be123c'}],
    [segments]
  );

  const sliceDeg = 360 / safeSegments.length;

  useEffect(() => {
    if (!wheelState || wheelState.status === 'idle') return;
    if (wheelState.spinId === lastSpinIdRef.current) return;

    lastSpinIdRef.current = wheelState.spinId;
    if (wheelState.status === 'spinning' || wheelState.status === 'awaiting_response') {
      const startRot = currentRotRef.current;
      const targetRot = wheelState.targetRotation;
      const duration = 4200;
      const startTime = performance.now();
      let lastTickSlice = Math.floor(startRot / sliceDeg);

      setIsAnimating(true);

      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        // Smooth quintic ease-out physics deceleration
        const eased = 1 - Math.pow(1 - t, 4.2);
        const current = startRot + (targetRot - startRot) * eased;
        currentRotRef.current = current;
        setRotation(current);

        const currentSlice = Math.floor(current / sliceDeg);
        if (currentSlice !== lastTickSlice) {
          lastTickSlice = currentSlice;
          soundEngine.playTick();
        }

        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          setIsAnimating(false);
          soundEngine.playWin();
          confetti({
            particleCount: 55,
            spread: 65,
            origin: {y: 0.58},
            colors: ['#fb7185', '#e11d48', '#fde68a', '#ffffff'],
          });
          if (
            wheelState.spunBy === role &&
            wheelState.status === 'spinning'
          ) {
            onUpdateWheel({
              ...wheelState,
              status: 'awaiting_response',
            }).catch(() => {});
          }
        }
      };

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(step);
    }
  }, [wheelState, sliceDeg, role, onUpdateWheel]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleSpin = async () => {
    if (isAnimating) return;
    const targetIndex = pickWeightedIndex(safeSegments);
    const chosen = safeSegments[targetIndex];

    // Top pointer is at 0deg (12 o'clock). Segment i covers [i*sliceDeg, (i+1)*sliceDeg] clockwise from top.
    const segmentCenter = targetIndex * sliceDeg + sliceDeg / 2;
    const jitter = (Math.random() - 0.5) * sliceDeg * 0.55;
    const desiredMod = (360 - (segmentCenter + jitter) + 360) % 360;
    const currentMod = ((currentRotRef.current % 360) + 360) % 360;
    const delta = (desiredMod - currentMod + 360) % 360;
    const extraSpins = 360 * (6 + Math.floor(Math.random() * 3));
    const targetRotation = currentRotRef.current + extraSpins + delta;

    await onUpdateWheel({
      spinId: `spin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      spunBy: role,
      targetIndex,
      targetLabel: chosen.label,
      targetRotation,
      status: 'spinning',
      timestamp: Date.now(),
    });
  };

  const handleDecision = async (decision: 'accepted' | 'rejected') => {
    if (!wheelState) return;
    if (decision === 'accepted') soundEngine.playKissPing();
    else soundEngine.playSad();
    await onUpdateWheel({
      ...wheelState,
      status: decision,
      respondedBy: role,
      timestamp: Date.now(),
    });
  };

  const handleCloseModal = async () => {
    if (!wheelState) return;
    await onUpdateWheel({
      ...wheelState,
      status: 'idle',
      timestamp: Date.now(),
    });
  };

  const showResultModal =
    !isAnimating &&
    wheelState &&
    (wheelState.status === 'awaiting_response' ||
      wheelState.status === 'accepted' ||
      wheelState.status === 'rejected');

  return (
    <div className="flex h-full w-full flex-col items-center justify-between py-2 px-2">
      {/* Header status strip */}
      <div className="w-full text-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
        <h2 className="text-base sm:text-lg font-extrabold text-white">
          لعبة رول الحظ
        </h2>
        <p className="text-[11px] font-semibold text-rose-100">
          {isAnimating
            ? 'العجلة تدور الآن...'
            : wheelState?.status === 'accepted'
              ? `تم القبول: ${wheelState.targetLabel}`
              : wheelState?.status === 'rejected'
                ? `تم الرفض: ${wheelState.targetLabel}`
                : 'أدر العجلة لتحديد التحدي اللحظي مع شريكك'}
        </p>
      </div>

      {/* Circular SVG Wheel */}
      <div className="relative flex items-center justify-center my-auto">
        {/* Top Pointer */}
        <div
          className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
          aria-hidden="true"
        >
          <svg width="30" height="34" viewBox="0 0 30 34" fill="none">
            <path
              d="M15 33L3 8C1.5 4.5 4 1 8 1H22C26 1 28.5 4.5 27 8L15 33Z"
              fill="#FDE68A"
              stroke="#78350F"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Outer Glow Ring */}
        <div className="relative h-[265px] w-[265px] sm:h-[310px] sm:w-[310px] rounded-full p-2 bg-gradient-to-br from-amber-300/40 via-rose-500/40 to-amber-500/40 shadow-[0_0_40px_rgba(225,29,72,0.35)]">
          <svg
            viewBox="0 0 200 200"
            className="h-full w-full rounded-full overflow-visible"
            style={{transform: `rotate(${rotation}deg)`}}
          >
            {safeSegments.map((seg, idx) => {
              const startAngle = idx * sliceDeg - 90;
              const endAngle = (idx + 1) * sliceDeg - 90;
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = (endAngle * Math.PI) / 180;
              const x1 = 100 + 96 * Math.cos(startRad);
              const y1 = 100 + 96 * Math.sin(startRad);
              const x2 = 100 + 96 * Math.cos(endRad);
              const y2 = 100 + 96 * Math.sin(endRad);
              const largeArc = sliceDeg > 180 ? 1 : 0;
              const pathData = `M 100 100 L ${x1} ${y1} A 96 96 0 ${largeArc} 1 ${x2} ${y2} Z`;
              const midAngle = startAngle + sliceDeg / 2;

              return (
                <g key={seg.id}>
                  <path
                    d={pathData}
                    fill={seg.color}
                    stroke="#ffe4e6"
                    strokeWidth="1.2"
                  />
                  <g transform={`rotate(${midAngle} 100 100)`}>
                    <text
                      x="154"
                      y="100"
                      fill="#ffffff"
                      fontSize={seg.label.length > 14 ? '5.4' : seg.label.length > 8 ? '6.6' : '8.5'}
                      fontWeight="700"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform="rotate(0 154 100)"
                      style={{paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.45)', strokeWidth: '1.2px'}}
                    >
                      {seg.label.length > 20 ? `${seg.label.slice(0, 19)}…` : seg.label}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Rim pegs */}
            {safeSegments.map((_, idx) => {
              const angle = ((idx * sliceDeg - 90) * Math.PI) / 180;
              const px = 100 + 93 * Math.cos(angle);
              const py = 100 + 93 * Math.sin(angle);
              return (
                <circle
                  key={`peg_${idx}`}
                  cx={px}
                  cy={py}
                  r="2.4"
                  fill="#fde68a"
                />
              );
            })}
          </svg>

          {/* Center Spin Hub */}
          <button
            type="button"
            disabled={isAnimating}
            onClick={handleSpin}
            className="absolute top-1/2 left-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-amber-200 bg-gradient-to-br from-rose-600 to-rose-900 text-white shadow-xl hover:scale-105 active:scale-95 transition disabled:opacity-75"
          >
            <RotateCw className={`h-5 w-5 ${isAnimating ? 'animate-spin' : ''}`} />
            <span className="text-[10px] font-extrabold mt-0.5">دوران</span>
          </button>
        </div>
      </div>

      {/* Primary Spin CTA */}
      <button
        type="button"
        disabled={isAnimating}
        onClick={handleSpin}
        className="w-full max-w-xs min-h-[46px] rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 px-6 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-rose-950/60 hover:from-rose-500 hover:to-rose-400 active:scale-[0.98] transition disabled:opacity-60"
      >
        {isAnimating ? 'جاري السحب...' : 'أدر عجلة الحظ'}
      </button>

      {/* Result Modal */}
      <AnimatePresence>
        {showResultModal && wheelState && (
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{scale: 0.85, opacity: 0}}
              animate={{scale: 1, opacity: 1}}
              exit={{scale: 0.85, opacity: 0}}
              className="w-full max-w-sm rounded-3xl border border-rose-300/30 bg-[#230612]/95 p-5 text-center text-white shadow-2xl"
            >
              <p className="text-xs font-semibold text-rose-300 mb-1">
                نتيجة عجلة الحظ ({wheelState.spunBy === 'male' ? 'أدارها الذكر' : 'أدارتها الأنثى'})
              </p>
              <div className="my-3 rounded-2xl border border-amber-300/30 bg-rose-900/55 px-4 py-5 text-xl font-extrabold text-amber-200 shadow-inner">
                {wheelState.targetLabel}
              </div>

              {wheelState.status === 'awaiting_response' ? (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => handleDecision('accepted')}
                    className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-emerald-500 active:scale-95 transition"
                  >
                    <Check className="h-4 w-4" />
                    <span>قبول</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision('rejected')}
                    className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-2xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-rose-600 active:scale-95 transition"
                  >
                    <X className="h-4 w-4" />
                    <span>رفض</span>
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <p
                    className={`text-sm font-bold ${
                      wheelState.status === 'accepted'
                        ? 'text-emerald-300'
                        : 'text-rose-300'
                    }`}
                  >
                    {wheelState.status === 'accepted'
                      ? `تم قبول النتيجة بواسطة ${wheelState.respondedBy === 'male' ? 'الذكر' : 'الأنثى'} ❤️`
                      : `تم رفض النتيجة بواسطة ${wheelState.respondedBy === 'male' ? 'الذكر' : 'الأنثى'}`}
                  </p>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full min-h-[42px] rounded-2xl bg-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white/25 transition"
                  >
                    إغلاق ولعب جولة جديدة
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
