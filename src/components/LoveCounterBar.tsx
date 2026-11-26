import React, {useEffect, useMemo, useState} from 'react';
import confetti from 'canvas-confetti';
import {CalendarHeart, Heart, PartyPopper, Sparkles, X} from 'lucide-react';
import {EncryptedRoomSettings} from '../types/app';
import {soundEngine} from '../services/sound';

interface LoveCounterBarProps {
  roomId: string;
  settings: EncryptedRoomSettings;
  onOpenSettings: () => void;
}

interface MilestoneInfo {
  id: string;
  title: string;
  subtitle: string;
}

function parseLocalDate(dateStr?: string): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function getLocalDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const LoveCounterBar: React.FC<LoveCounterBarProps> = ({
  roomId,
  settings,
  onOpenSettings,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const nowDate = useMemo(() => new Date(nowMs), [nowMs]);
  const todayKey = useMemo(() => getLocalDayKey(nowDate), [nowDate]);
  const anniversaryDate = useMemo(
    () => parseLocalDate(settings.anniversaryDate),
    [settings.anniversaryDate]
  );
  const upcomingDate = useMemo(
    () => parseLocalDate(settings.upcomingEventDate),
    [settings.upcomingEventDate]
  );

  const elapsed = useMemo(() => {
    if (!anniversaryDate) return null;
    const diff = nowMs - anniversaryDate.getTime();
    if (diff < 0) return {days: 0, hours: 0, minutes: 0, upcoming: true};
    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    return {days, hours, minutes, upcoming: false};
  }, [anniversaryDate, nowMs]);

  const upcomingDaysLeft = useMemo(() => {
    if (!upcomingDate) return null;
    const todayMidnight = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth(),
      nowDate.getDate(),
      0,
      0,
      0,
      0
    );
    const diffDays = Math.round(
      (upcomingDate.getTime() - todayMidnight.getTime()) / 86400000
    );
    return diffDays;
  }, [upcomingDate, nowDate]);

  const activeMilestone = useMemo<MilestoneInfo | null>(() => {
    // Check exact upcoming special date first
    if (
      settings.upcomingEventDate &&
      settings.upcomingEventDate === todayKey
    ) {
      return {
        id: `event_${todayKey}`,
        title: settings.upcomingEventTitle?.trim() || 'اليوم مناسبتنا الخاصة! 🎉',
        subtitle: 'كل لحظة معك تزيد حياتنا بهجة وحباً لا ينتهي ❤️',
      };
    }

    // Check monthly / yearly anniversary milestone
    if (anniversaryDate) {
      const startYear = anniversaryDate.getFullYear();
      const startMonth = anniversaryDate.getMonth();
      const startDay = anniversaryDate.getDate();

      const curYear = nowDate.getFullYear();
      const curMonth = nowDate.getMonth();
      const curDay = nowDate.getDate();

      const monthsTotal = (curYear - startYear) * 12 + (curMonth - startMonth);
      if (monthsTotal >= 1 && curDay === startDay) {
        if (monthsTotal % 12 === 0) {
          const years = monthsTotal / 12;
          return {
            id: `year_${years}_${todayKey}`,
            title:
              years === 1
                ? 'ذكرى سنوية سعيدة! أتممنا عاماً معاً 💍'
                : `ذكرى سنوية سعيدة! ${years} أعوام من الحب ❤️`,
            subtitle: 'عقبال العمر كله سوية في سعادة ومودة دائمة ✨',
          };
        }
        return {
          id: `month_${monthsTotal}_${todayKey}`,
          title: `كل شهر وأنتما لبعضكما ❤️ (${monthsTotal} شهر)`,
          subtitle: 'احتفالنا الشهري ببداية أجمل قصة حب ✨',
        };
      }
    }

    return null;
  }, [
    settings.upcomingEventDate,
    settings.upcomingEventTitle,
    anniversaryDate,
    nowDate,
    todayKey,
  ]);

  const storageKey = activeMilestone
    ? `nabd_milestone_dismissed_${roomId}_${activeMilestone.id}`
    : null;

  const isDismissed = useMemo(() => {
    if (!storageKey) return true;
    if (dismissedKey === storageKey) return true;
    try {
      return sessionStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  }, [storageKey, dismissedKey]);

  const showCelebration = Boolean(activeMilestone && !isDismissed);

  useEffect(() => {
    if (!showCelebration) return;
    soundEngine.playWin();
    confetti({
      particleCount: 110,
      spread: 95,
      origin: {y: 0.45},
      colors: ['#fb7185', '#e11d48', '#fde68a', '#f472b6', '#ffffff'],
    });
  }, [showCelebration, activeMilestone?.id]);

  const dismissCelebration = () => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      // ignore storage quota
    }
    setDismissedKey(storageKey);
  };

  return (
    <>
      <div className="mt-1.5 flex shrink-0 items-center justify-between gap-2 rounded-2xl border border-rose-200/20 bg-black/45 px-2.5 py-1.5 backdrop-blur-xl shadow">
        {elapsed ? (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex flex-1 min-w-0 items-center gap-1.5 text-right group"
          >
            <Heart className="h-3.5 w-3.5 shrink-0 fill-rose-500 text-rose-400 animate-pulse" />
            <span className="text-[10px] sm:text-xs font-bold text-rose-100 truncate">
              معاً منذ:
            </span>
            <div
              dir="ltr"
              className="font-mono-num flex items-center gap-1 text-[10px] sm:text-xs font-extrabold text-amber-200"
            >
              <span className="rounded-md bg-rose-500/25 px-1.5 py-0.5">
                {elapsed.days} يوم
              </span>
              <span className="rounded-md bg-white/10 px-1.5 py-0.5">
                {String(elapsed.hours).padStart(2, '0')}س
              </span>
              <span className="rounded-md bg-white/10 px-1.5 py-0.5">
                {String(elapsed.minutes).padStart(2, '0')}د
              </span>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex flex-1 min-w-0 items-center gap-1.5 text-[10px] sm:text-xs font-bold text-rose-200 hover:text-white transition"
          >
            <CalendarHeart className="h-3.5 w-3.5 shrink-0 text-rose-400" />
            <span className="truncate">أضف تاريخ بداية ارتباطنا / زواجنا ❤️</span>
          </button>
        )}

        {upcomingDaysLeft !== null && upcomingDaysLeft >= 0 && (
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-amber-300/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-100">
            <Sparkles className="h-3 w-3 text-amber-300 shrink-0" />
            <span className="max-w-[110px] truncate">
              {upcomingDaysLeft === 0
                ? settings.upcomingEventTitle || 'اليوم! 🎉'
                : `${settings.upcomingEventTitle || 'مناسبة'}: ${upcomingDaysLeft}ي`}
            </span>
          </div>
        )}
      </div>

      {/* Auto Milestone Romantic Celebration Overlay */}
      {showCelebration && activeMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-amber-300/60 bg-gradient-to-b from-rose-900/95 via-[#2a0715]/95 to-black/95 p-6 text-center text-white shadow-2xl">
            <button
              type="button"
              onClick={dismissCelebration}
              aria-label="إغلاق الاحتفال"
              className="absolute top-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-rose-600 transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/30 border border-amber-300/50 shadow-lg">
              <PartyPopper className="h-8 w-8 text-amber-300 animate-bounce" />
            </div>

            <h3 className="text-lg font-extrabold text-amber-200 leading-snug">
              {activeMilestone.title}
            </h3>
            <p className="mt-2 text-xs sm:text-sm font-semibold text-rose-100 leading-relaxed">
              {activeMilestone.subtitle}
            </p>

            <div className="mt-4 flex justify-center gap-2 text-2xl">
              <span className="animate-bounce">❤️</span>
              <span className="animate-pulse">💋</span>
              <span className="animate-bounce">🥂</span>
            </div>

            <button
              type="button"
              onClick={dismissCelebration}
              className="mt-5 w-full min-h-[42px] rounded-2xl bg-gradient-to-r from-rose-600 to-pink-500 text-sm font-extrabold text-white shadow-lg hover:from-rose-500 hover:to-pink-400 transition"
            >
              شكراً يا أغلى من في الكون ❤️
            </button>
          </div>
        </div>
      )}
    </>
  );
};
