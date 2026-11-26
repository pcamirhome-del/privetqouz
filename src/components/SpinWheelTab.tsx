import React, {useEffect, useMemo, useRef, useState} from 'react';
import confetti from 'canvas-confetti';
import {AnimatePresence, motion} from 'motion/react';
import {Check, Lock, RotateCw, Shuffle, Sparkles, X} from 'lucide-react';
import {
  DailyWheelPick,
  PartnerRole,
  WheelFinalDraw,
  WheelLiveState,
  WheelSegment,
} from '../types/app';
import {soundEngine} from '../services/sound';

interface SpinWheelTabProps {
  role: PartnerRole;
  segments: WheelSegment[];
  wheelState: WheelLiveState | null;
  onUpdateWheel: (next: WheelLiveState) => Promise<void>;
  confirmedTaskIds?: string[];
  onConfirmTaskCompletion?: (
    taskId: string,
    executingRole: PartnerRole
  ) => Promise<void>;
}

function getLocalDayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function pickWeightedSegment(
  segments: WheelSegment[],
  excludeLabel?: string,
  excludeIndex?: number
): {chosen: WheelSegment; originalIndex: number} {
  const indexed = segments.map((seg, idx) => ({seg, idx}));
  const filtered = indexed.filter(({seg, idx}) => {
    if (excludeIndex !== undefined && idx === excludeIndex) return false;
    if (excludeLabel && seg.label.trim() === excludeLabel.trim()) return false;
    return true;
  });
  const pool = filtered.length > 0 ? filtered : indexed;

  const total = pool.reduce((acc, item) => acc + Math.max(0.1, item.seg.weight), 0);
  let r = Math.random() * total;
  for (const item of pool) {
    r -= Math.max(0.1, item.seg.weight);
    if (r <= 0) return {chosen: item.seg, originalIndex: item.idx};
  }
  const fallback = pool[pool.length - 1];
  return {chosen: fallback.seg, originalIndex: fallback.idx};
}

export const SpinWheelTab: React.FC<SpinWheelTabProps> = ({
  role,
  segments,
  wheelState,
  onUpdateWheel,
  confirmedTaskIds = [],
  onConfirmTaskCompletion,
}) => {
  const [rotation, setRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [drawHighlight, setDrawHighlight] = useState<PartnerRole>('male');
  const [isDrawShuffling, setIsDrawShuffling] = useState(false);

  const lastSpinIdRef = useRef<string | null>(null);
  const lastDrawIdRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const currentRotRef = useRef(0);

  const todayKey = getLocalDayKey();

  const safeSegments = useMemo(
    () =>
      segments.length > 0
        ? segments
        : [{id: 'default', label: 'مم', weight: 10, color: '#be123c'}],
    [segments]
  );

  const sliceDeg = 360 / safeSegments.length;

  const isTodayState = wheelState?.dayKey === todayKey;
  const malePickToday: DailyWheelPick | null = isTodayState
    ? wheelState?.maleDailyPick || null
    : null;
  const femalePickToday: DailyWheelPick | null = isTodayState
    ? wheelState?.femaleDailyPick || null
    : null;

  const myPickToday = role === 'male' ? malePickToday : femalePickToday;
  const partnerPickToday = role === 'male' ? femalePickToday : malePickToday;
  const hasSpunToday = Boolean(myPickToday);
  const bothSpunToday = Boolean(malePickToday && femalePickToday);
  const todayFinalDraw: WheelFinalDraw | null =
    isTodayState && wheelState?.finalDraw?.dayKey === todayKey
      ? wheelState.finalDraw
      : null;

  // Wheel Spin Physics Animation
  useEffect(() => {
    if (!wheelState || wheelState.status === 'idle') return;
    if (wheelState.spinId === lastSpinIdRef.current) return;

    lastSpinIdRef.current = wheelState.spinId;
    if (
      wheelState.status === 'spinning' ||
      wheelState.status === 'awaiting_response'
    ) {
      const startRot = currentRotRef.current;
      const targetRot = wheelState.targetRotation;
      const duration = 4200;
      const startTime = performance.now();
      let lastTickSlice = Math.floor(startRot / sliceDeg);

      setIsAnimating(true);

      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
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
          if (wheelState.spunBy === role && wheelState.status === 'spinning') {
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

  // Synced 3-Second Alternation Animation Between Husband's & Wife's Pick
  useEffect(() => {
    if (!todayFinalDraw || todayFinalDraw.status !== 'shuffling') {
      setIsDrawShuffling(false);
      return;
    }
    if (todayFinalDraw.drawId === lastDrawIdRef.current) return;

    lastDrawIdRef.current = todayFinalDraw.drawId;
    setIsDrawShuffling(true);

    let toggle: PartnerRole = 'male';
    const interval = setInterval(() => {
      toggle = toggle === 'male' ? 'female' : 'male';
      setDrawHighlight(toggle);
      soundEngine.playTick();
    }, 180);

    const endTimer = setTimeout(() => {
      clearInterval(interval);
      setDrawHighlight(todayFinalDraw.chosenRole);
      setIsDrawShuffling(false);
      soundEngine.playWin();
      confetti({
        particleCount: 85,
        spread: 80,
        origin: {y: 0.55},
        colors: ['#fb7185', '#fde68a', '#38bdf8', '#ffffff'],
      });

      if (wheelState && todayFinalDraw.status === 'shuffling') {
        onUpdateWheel({
          ...wheelState,
          finalDraw: {
            ...todayFinalDraw,
            status: 'revealed',
          },
          timestamp: Date.now(),
        }).catch(() => {});
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(endTimer);
    };
  }, [todayFinalDraw, wheelState, onUpdateWheel]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleSpin = async () => {
    if (isAnimating || hasSpunToday) return;

    // Exclude partner's result from today so both NEVER receive the same outcome
    const {chosen, originalIndex} = pickWeightedSegment(
      safeSegments,
      partnerPickToday?.targetLabel,
      partnerPickToday?.targetIndex
    );

    const segmentCenter = originalIndex * sliceDeg + sliceDeg / 2;
    const jitter = (Math.random() - 0.5) * sliceDeg * 0.55;
    const desiredMod = (360 - (segmentCenter + jitter) + 360) % 360;
    const currentMod = ((currentRotRef.current % 360) + 360) % 360;
    const delta = (desiredMod - currentMod + 360) % 360;
    const extraSpins = 360 * (6 + Math.floor(Math.random() * 3));
    const targetRotation = currentRotRef.current + extraSpins + delta;

    const newPick: DailyWheelPick = {
      dayKey: todayKey,
      role,
      targetIndex: originalIndex,
      targetLabel: chosen.label,
      spunAt: Date.now(),
    };

    await onUpdateWheel({
      spinId: `spin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      spunBy: role,
      targetIndex: originalIndex,
      targetLabel: chosen.label,
      targetRotation,
      status: 'spinning',
      timestamp: Date.now(),
      dayKey: todayKey,
      maleDailyPick: role === 'male' ? newPick : malePickToday,
      femaleDailyPick: role === 'female' ? newPick : femalePickToday,
      finalDraw: todayFinalDraw,
    });
  };

  const handleStartFinalRandomDraw = async () => {
    if (!bothSpunToday || !malePickToday || !femalePickToday || isDrawShuffling) return;
    const chosenRole: PartnerRole = Math.random() < 0.5 ? 'male' : 'female';
    const chosenLabel =
      chosenRole === 'male' ? malePickToday.targetLabel : femalePickToday.targetLabel;

    await onUpdateWheel({
      ...(wheelState || {
        spinId: `spin_${Date.now()}`,
        spunBy: role,
        targetIndex: 0,
        targetLabel: chosenLabel,
        targetRotation: currentRotRef.current,
        status: 'idle',
        timestamp: Date.now(),
      }),
      dayKey: todayKey,
      maleDailyPick: malePickToday,
      femaleDailyPick: femalePickToday,
      finalDraw: {
        drawId: `draw_${Date.now()}`,
        dayKey: todayKey,
        maleLabel: malePickToday.targetLabel,
        femaleLabel: femalePickToday.targetLabel,
        chosenRole,
        chosenLabel,
        startedAt: Date.now(),
        status: 'shuffling',
      },
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
    <div className="flex h-full w-full flex-col items-center justify-between py-1 px-1.5">
      {/* Header + Daily Results Strip */}
      <div className="w-full space-y-1.5">
        <div className="text-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
          <h2 className="text-sm sm:text-base font-extrabold text-white">
            لعبة عجلة الحظ اليومية
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div
            className={`rounded-xl border px-2 py-1 text-center transition ${
              isDrawShuffling && drawHighlight === 'male'
                ? 'border-amber-300 bg-amber-500/40 scale-[1.03]'
                : todayFinalDraw?.status === 'revealed' &&
                    todayFinalDraw.chosenRole === 'male'
                  ? 'border-emerald-300 bg-emerald-600/40'
                  : 'border-sky-300/30 bg-black/30'
            }`}
          >
            <span className="block text-[10px] font-bold text-sky-200">
              👨🏻 اختيار الزوج اليوم
            </span>
            <span className="block truncate text-[11px] font-extrabold text-white">
              {malePickToday ? malePickToday.targetLabel : 'لم يلف بعد'}
            </span>
          </div>

          <div
            className={`rounded-xl border px-2 py-1 text-center transition ${
              isDrawShuffling && drawHighlight === 'female'
                ? 'border-amber-300 bg-amber-500/40 scale-[1.03]'
                : todayFinalDraw?.status === 'revealed' &&
                    todayFinalDraw.chosenRole === 'female'
                  ? 'border-emerald-300 bg-emerald-600/40'
                  : 'border-rose-300/30 bg-black/30'
            }`}
          >
            <span className="block text-[10px] font-bold text-rose-200">
              👩🏻 اختيار الزوجة اليوم
            </span>
            <span className="block truncate text-[11px] font-extrabold text-white">
              {femalePickToday ? femalePickToday.targetLabel : 'لم تلف بعد'}
            </span>
          </div>
        </div>
      </div>

      {/* Circular SVG Wheel */}
      <div className="relative flex items-center justify-center my-auto">
        <div
          className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
          aria-hidden="true"
        >
          <svg width="28" height="32" viewBox="0 0 30 34" fill="none">
            <path
              d="M15 33L3 8C1.5 4.5 4 1 8 1H22C26 1 28.5 4.5 27 8L15 33Z"
              fill="#FDE68A"
              stroke="#78350F"
              strokeWidth="2"
            />
          </svg>
        </div>

        <div className="relative h-[225px] w-[225px] sm:h-[265px] sm:w-[265px] rounded-full p-2 bg-gradient-to-br from-amber-300/40 via-rose-500/40 to-amber-500/40 shadow-[0_0_36px_rgba(225,29,72,0.35)]">
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
            disabled={isAnimating || hasSpunToday}
            onClick={handleSpin}
            className="absolute top-1/2 left-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-amber-200 bg-gradient-to-br from-rose-600 to-rose-900 text-white shadow-xl hover:scale-105 active:scale-95 transition disabled:opacity-70"
          >
            {hasSpunToday ? (
              <Lock className="h-4 w-4" />
            ) : (
              <RotateCw className={`h-4 w-4 ${isAnimating ? 'animate-spin' : ''}`} />
            )}
            <span className="text-[9px] font-extrabold mt-0.5">
              {hasSpunToday ? 'تم اليوم' : 'دوران'}
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Action Controls */}
      <div className="w-full max-w-sm space-y-1.5">
        {todayFinalDraw?.status === 'revealed' && !isDrawShuffling && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-300/45 bg-gradient-to-r from-rose-700/75 via-amber-600/55 to-rose-700/75 px-3 py-1.5 text-xs font-extrabold text-white shadow">
            <span className="truncate">
              ✨ الاختيار النهائي لليوم:{' '}
              <span className="text-amber-200">{todayFinalDraw.chosenLabel}</span>
            </span>
            {onConfirmTaskCompletion &&
              role !== todayFinalDraw.chosenRole &&
              (() => {
                const drawTaskId = `wheel_draw_${todayFinalDraw.drawId}`;
                const done = confirmedTaskIds.includes(drawTaskId);
                return done ? (
                  <span className="shrink-0 rounded-lg bg-emerald-600/80 px-2 py-0.5 text-[10px] font-bold text-white">
                    تم +1 ✅
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      onConfirmTaskCompletion(drawTaskId, todayFinalDraw.chosenRole)
                    }
                    className="shrink-0 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-extrabold text-white shadow hover:bg-emerald-400 active:scale-95 transition"
                  >
                    تم التنفيذ ✅
                  </button>
                );
              })()}
          </div>
        )}

        {!hasSpunToday ? (
          <button
            type="button"
            disabled={isAnimating}
            onClick={handleSpin}
            className="w-full min-h-[42px] rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-2 text-xs sm:text-sm font-extrabold text-white shadow-lg hover:from-rose-500 hover:to-rose-400 active:scale-[0.98] transition disabled:opacity-60"
          >
            {isAnimating ? 'جاري السحب...' : 'أدر عجلة الحظ (فرصتك اليومية)'}
          </button>
        ) : bothSpunToday ? (
          <button
            type="button"
            disabled={isDrawShuffling || isAnimating}
            onClick={handleStartFinalRandomDraw}
            className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 px-4 py-2 text-xs sm:text-sm font-extrabold text-white shadow-lg hover:from-amber-400 hover:to-rose-500 active:scale-[0.98] transition disabled:opacity-60"
          >
            <Shuffle className={`h-4 w-4 ${isDrawShuffling ? 'animate-spin' : ''}`} />
            <span>
              {isDrawShuffling
                ? 'جاري التبديل بين اختيار الزوج والزوجة...'
                : 'اختيار عشوائي من نتيجة الزوج والزوجة'}
            </span>
          </button>
        ) : (
          <div className="flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-2xl border border-rose-300/25 bg-black/35 px-3 py-1.5 text-[11px] font-bold text-rose-100">
            <Sparkles className="h-3.5 w-3.5 text-amber-300 shrink-0" />
            <span>
              استخدمت دورتك اليوم ({myPickToday?.targetLabel}) · بانتظار دوران{' '}
              {role === 'male' ? 'الزوجة' : 'الزوج'}
            </span>
          </div>
        )}
      </div>

      {/* 3-Second Alternation Full Focus Overlay */}
      <AnimatePresence>
        {isDrawShuffling && malePickToday && femalePickToday && (
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          >
            <div className="w-full max-w-sm rounded-3xl border border-amber-300/45 bg-[#200611]/95 p-5 text-center text-white shadow-2xl space-y-3">
              <p className="text-xs font-extrabold text-amber-200">
                جاري الاختيار العشوائي بين نتيجة الزوج والزوجة...
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <div
                  className={`rounded-2xl border-2 p-3 transition ${
                    drawHighlight === 'male'
                      ? 'border-amber-300 bg-sky-600/80 scale-105 shadow-xl'
                      : 'border-white/15 bg-black/40 opacity-55'
                  }`}
                >
                  <span className="block text-[11px] font-bold text-sky-100">
                    👨🏻 الزوج
                  </span>
                  <span className="mt-1 block text-sm font-extrabold text-white">
                    {malePickToday.targetLabel}
                  </span>
                </div>
                <div
                  className={`rounded-2xl border-2 p-3 transition ${
                    drawHighlight === 'female'
                      ? 'border-amber-300 bg-rose-600/80 scale-105 shadow-xl'
                      : 'border-white/15 bg-black/40 opacity-55'
                  }`}
                >
                  <span className="block text-[11px] font-bold text-rose-100">
                    👩🏻 الزوجة
                  </span>
                  <span className="mt-1 block text-sm font-extrabold text-white">
                    {femalePickToday.targetLabel}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single Spin Result Modal */}
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
                نتيجة عجلة الحظ ({wheelState.spunBy === 'male' ? 'أدارها الزوج' : 'أدارتها الزوجة'})
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
                <div className="mt-3 space-y-2.5">
                  <p
                    className={`text-sm font-bold ${
                      wheelState.status === 'accepted'
                        ? 'text-emerald-300'
                        : 'text-rose-300'
                    }`}
                  >
                    {wheelState.status === 'accepted'
                      ? `تم قبول النتيجة بواسطة ${wheelState.respondedBy === 'male' ? 'الزوج' : 'الزوجة'} ❤️`
                      : `تم رفض النتيجة بواسطة ${wheelState.respondedBy === 'male' ? 'الزوج' : 'الزوجة'}`}
                  </p>
                  {wheelState.status === 'accepted' &&
                    onConfirmTaskCompletion &&
                    role !== wheelState.spunBy &&
                    (() => {
                      const spinTaskId = `wheel_${wheelState.spinId}`;
                      const done = confirmedTaskIds.includes(spinTaskId);
                      return done ? (
                        <div className="rounded-xl bg-emerald-600/35 border border-emerald-400/40 py-2 text-xs font-extrabold text-emerald-200">
                          تم احتساب +1 نقطة لـ{wheelState.spunBy === 'male' ? 'لزوج' : 'لزوجة'} ✅
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            onConfirmTaskCompletion(spinTaskId, wheelState.spunBy)
                          }
                          className="w-full min-h-[44px] rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-sm font-extrabold text-white shadow-lg hover:from-emerald-500 hover:to-emerald-400 active:scale-95 transition"
                        >
                          تم التنفيذ ✅ (+1 نقطة)
                        </button>
                      );
                    })()}
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full min-h-[42px] rounded-2xl bg-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white/25 transition"
                  >
                    إغلاق
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
