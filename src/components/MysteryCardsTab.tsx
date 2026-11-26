import React, {useEffect, useMemo, useState} from 'react';
import confetti from 'canvas-confetti';
import {Clock, Gift, Sparkles} from 'lucide-react';
import {
  DEFAULT_MYSTERY_CARDS,
  FlippedCardRecord,
  MysteryCardItem,
  MysteryCardsLiveState,
  PartnerRole,
  ReactionEvent,
} from '../types/app';
import {soundEngine} from '../services/sound';

interface MysteryCardsTabProps {
  role: PartnerRole;
  cardsPool?: MysteryCardItem[];
  cardsState: MysteryCardsLiveState | null;
  onUpdateCards: (next: MysteryCardsLiveState) => Promise<void>;
  onTriggerReaction: (evt: ReactionEvent) => Promise<void>;
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

function getMsUntilLocalMidnight(now = new Date()): number {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  );
  return Math.max(0, nextMidnight.getTime() - now.getTime());
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function buildDynamicBoardSlots(pool: MysteryCardItem[]): MysteryCardItem[] {
  const source = pool.length > 0 ? [...pool] : [...DEFAULT_MYSTERY_CARDS];
  // Fisher-Yates shuffle while preserving the exact number of configured options
  for (let i = source.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [source[i], source[j]] = [source[j], source[i]];
  }
  return source.map((item, i) => ({
    id: `${item.id}_${i}`,
    text: item.text,
  }));
}

export const MysteryCardsTab: React.FC<MysteryCardsTabProps> = ({
  role,
  cardsPool,
  cardsState,
  onUpdateCards,
  onTriggerReaction,
  confirmedTaskIds = [],
  onConfirmTaskCompletion,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [flippingSlot, setFlippingSlot] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const todayKey = useMemo(() => getLocalDayKey(new Date(nowMs)), [nowMs]);
  const msUntilMidnight = useMemo(
    () => getMsUntilLocalMidnight(new Date(nowMs)),
    [nowMs]
  );

  const effectivePool = useMemo(
    () => (cardsPool && cardsPool.length > 0 ? cardsPool : DEFAULT_MYSTERY_CARDS),
    [cardsPool]
  );

  const poolSignature = useMemo(
    () =>
      [...effectivePool]
        .map((c) => c.text.trim())
        .sort()
        .join('|'),
    [effectivePool]
  );

  const localFallbackSlots = useMemo(
    () => buildDynamicBoardSlots(effectivePool),
    // Re-deal only if dayKey changes or pool changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayKey, effectivePool.map((c) => `${c.id}:${c.text}`).join('|')]
  );

  const isStateForToday = cardsState?.dayKey === todayKey;
  const maleFlip = isStateForToday ? cardsState?.maleFlip || null : null;
  const femaleFlip = isStateForToday ? cardsState?.femaleFlip || null : null;

  const syncedMatchesPool = useMemo(() => {
    if (!isStateForToday || !cardsState?.boardSlots) return false;
    if (cardsState.boardSlots.length !== effectivePool.length) return false;
    if (maleFlip || femaleFlip) return true;
    const syncedSig = [...cardsState.boardSlots]
      .map((c) => c.text.trim())
      .sort()
      .join('|');
    return syncedSig === poolSignature;
  }, [
    isStateForToday,
    cardsState?.boardSlots,
    effectivePool.length,
    maleFlip,
    femaleFlip,
    poolSignature,
  ]);

  const boardSlots = syncedMatchesPool
    ? cardsState!.boardSlots
    : localFallbackSlots;

  const myFlip = role === 'male' ? maleFlip : femaleFlip;
  const partnerFlip = role === 'male' ? femaleFlip : maleFlip;

  const isLockedToday = Boolean(myFlip && myFlip.dayKey === todayKey);

  const handleFlipCard = async (slotIndex: number) => {
    if (isLockedToday || flippingSlot !== null) return;
    // Prevent picking a slot already flipped today by the partner if another face-down slot exists
    if (partnerFlip && partnerFlip.slotIndex === slotIndex) return;

    const chosenCard = boardSlots[slotIndex];
    if (!chosenCard) return;

    setFlippingSlot(slotIndex);
    setErrorMsg(null);

    try {
      const record: FlippedCardRecord = {
        slotIndex,
        cardId: chosenCard.id,
        text: chosenCard.text,
        flippedBy: role,
        flippedAt: Date.now(),
        dayKey: todayKey,
      };

      const nextState: MysteryCardsLiveState = {
        dayKey: todayKey,
        boardSlots,
        maleFlip: role === 'male' ? record : maleFlip,
        femaleFlip: role === 'female' ? record : femaleFlip,
        lastFlipped: record,
        updatedAt: Date.now(),
      };

      soundEngine.playCardFlip();
      confetti({
        particleCount: 65,
        spread: 75,
        origin: {y: 0.56},
        colors: ['#fb7185', '#f43f5e', '#fde68a', '#ffffff'],
      });

      await onUpdateCards(nextState);
      await onTriggerReaction({
        id: `card_${Date.now().toString(36)}`,
        type: 'kiss',
        source: 'card',
        triggeredBy: role,
        label: chosenCard.text,
        timestamp: Date.now(),
      }).catch(() => {});
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر مزامنة البطاقة.');
    } finally {
      setFlippingSlot(null);
    }
  };

  const activeDailyCard =
    (isStateForToday && cardsState?.lastFlipped) || myFlip || partnerFlip || null;

  return (
    <div className="flex h-full flex-col justify-between gap-2 overflow-hidden">
      {/* Top Status / Countdown Header */}
      <div className="shrink-0 rounded-2xl border border-rose-300/25 bg-black/25 px-3 py-2 text-center backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-100 drop-shadow">
            <Sparkles className="h-3.5 w-3.5 text-amber-300 shrink-0" />
            <span>كروت المفاجآت اليومية</span>
          </div>

          {isLockedToday ? (
            <div className="flex items-center gap-1 rounded-xl border border-rose-300/30 bg-rose-950/65 px-2 py-0.5 text-[10px] sm:text-xs font-bold text-amber-200">
              <Clock className="h-3 w-3 text-amber-300 shrink-0" />
              <span>التالية بعد:</span>
              <span className="font-mono-num" dir="ltr">
                {formatCountdown(msUntilMidnight)}
              </span>
            </div>
          ) : (
            <span className="rounded-xl bg-rose-600/80 px-2 py-0.5 text-[10px] sm:text-xs font-bold text-white shadow">
              اختر بطاقة واحدة لليوم ✨
            </span>
          )}
        </div>

        {activeDailyCard && (
          <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-rose-600/35 via-pink-500/35 to-rose-600/35 px-2.5 py-1 text-[11px] font-bold text-white border border-rose-200/20">
            <div className="flex items-center gap-1.5 min-w-0">
              <Gift className="h-3.5 w-3.5 text-amber-300 shrink-0" />
              <span className="truncate">
                مكافأة اليوم ({activeDailyCard.flippedBy === 'male' ? 'الزوج' : 'الزوجة'}):{' '}
                <strong className="text-amber-200">{activeDailyCard.text}</strong>
              </span>
            </div>
            {onConfirmTaskCompletion &&
              activeDailyCard.flippedBy !== role &&
              (() => {
                const taskId = `card_${todayKey}_${activeDailyCard.flippedBy}_${activeDailyCard.slotIndex}`;
                const done = confirmedTaskIds.includes(taskId);
                return done ? (
                  <span className="shrink-0 rounded-lg bg-emerald-600/85 px-2 py-0.5 text-[10px] font-extrabold text-white">
                    تم +1 ✅
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      onConfirmTaskCompletion(taskId, activeDailyCard.flippedBy)
                    }
                    className="shrink-0 rounded-lg bg-emerald-500 px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow hover:bg-emerald-400 active:scale-95 transition"
                  >
                    تم التنفيذ ✅
                  </button>
                );
              })()}
          </div>
        )}

        {errorMsg && (
          <p className="mt-1 text-[11px] font-bold text-rose-200">{errorMsg}</p>
        )}
      </div>

      {/* Dynamic 3D Flip Cards Grid matching exact Settings card count (1 to N) */}
      <div
        className={`grid flex-1 min-h-0 gap-2 py-0.5 ${
          boardSlots.length === 1
            ? 'grid-cols-1'
            : boardSlots.length === 2 || boardSlots.length === 4
              ? 'grid-cols-2'
              : boardSlots.length <= 6
                ? 'grid-cols-3'
                : 'grid-cols-3 sm:grid-cols-4 auto-rows-[minmax(72px,1fr)] overflow-y-auto inner-scroll'
        }`}
      >
        {boardSlots.map((card, idx) => {
          const cardNumber = idx + 1;
          const flippedByMale = maleFlip?.slotIndex === idx ? maleFlip : null;
          const flippedByFemale = femaleFlip?.slotIndex === idx ? femaleFlip : null;
          const flippedRecord = flippedByMale || flippedByFemale;
          const isFlipped = Boolean(flippedRecord);
          const canClick = !isFlipped && !isLockedToday && flippingSlot === null;

          return (
            <button
              key={`${todayKey}_${idx}_${card.id}`}
              type="button"
              disabled={!canClick}
              onClick={() => handleFlipCard(idx)}
              style={{perspective: '1000px'}}
              aria-label={`بطاقة رقم ${cardNumber}`}
              className={`group relative h-full w-full min-h-[68px] rounded-2xl focus:outline-none ${
                canClick ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div
                style={{
                  transformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  transition: 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
                className="relative h-full w-full"
              >
                {/* Card Front (Sequential Number 1..N centered cleanly on closed face) */}
                <div
                  style={{backfaceVisibility: 'hidden'}}
                  className={`absolute inset-0 flex items-center justify-center rounded-2xl border p-2 shadow-lg transition ${
                    isLockedToday
                      ? 'border-rose-200/15 bg-black/40 opacity-70'
                      : 'border-rose-300/40 bg-gradient-to-br from-rose-900/75 via-[#2c0918]/80 to-rose-950/85 hover:border-amber-300/60 hover:scale-[1.015] active:scale-[0.98]'
                  } backdrop-blur-sm`}
                >
                  <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-dashed border-amber-200/25" />
                  <span
                    dir="ltr"
                    className="font-mono-num tabular-nums select-none text-3xl sm:text-4xl font-black leading-none text-amber-200 drop-shadow-[0_2px_10px_rgba(251,191,36,0.45)]"
                  >
                    {cardNumber}
                  </span>
                </div>

                {/* Card Back (Revealed Reward Side) */}
                <div
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-amber-300/70 bg-gradient-to-br from-rose-600/90 via-pink-700/90 to-[#3a0a1e]/95 p-2.5 text-center shadow-2xl backdrop-blur-md"
                >
                  <span className="rounded-full bg-black/35 px-2 py-0.5 text-[9px] font-extrabold text-amber-200 border border-amber-200/30">
                    {flippedRecord?.flippedBy === 'male'
                      ? 'اختيار الزوج 💙'
                      : 'اختيار الزوجة 💖'}
                  </span>
                  <p className="text-[11px] sm:text-xs font-extrabold leading-snug text-white drop-shadow break-words line-clamp-3">
                    {flippedRecord?.text || card.text}
                  </p>
                  {flippedRecord &&
                  onConfirmTaskCompletion &&
                  flippedRecord.flippedBy !== role ? (
                    (() => {
                      const taskId = `card_${todayKey}_${flippedRecord.flippedBy}_${flippedRecord.slotIndex}`;
                      const done = confirmedTaskIds.includes(taskId);
                      return done ? (
                        <span className="rounded-lg bg-emerald-600/85 px-2 py-0.5 text-[9px] font-extrabold text-white">
                          تم احتساب +1 ✅
                        </span>
                      ) : (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            void onConfirmTaskCompletion(
                              taskId,
                              flippedRecord.flippedBy
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              void onConfirmTaskCompletion(
                                taskId,
                                flippedRecord.flippedBy
                              );
                            }
                          }}
                          className="cursor-pointer rounded-lg bg-emerald-500 px-2.5 py-1 text-[10px] font-extrabold text-white shadow hover:bg-emerald-400"
                        >
                          تم التنفيذ ✅
                        </span>
                      );
                    })()
                  ) : (
                    <span className="text-[9px] font-bold text-rose-100/90">
                      تم تفعيلها لليوم ❤️
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
