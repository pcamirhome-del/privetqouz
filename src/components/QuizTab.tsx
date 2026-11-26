import React, {useEffect, useMemo, useState} from 'react';
import {
  Award,
  Clock,
  Play,
  RefreshCw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {
  EncryptedRoomSettings,
  PartnerRole,
  QuizCategory,
  QuizQuestion,
  QuizRewardButton,
  QuizRoundState,
  ReactionEvent,
} from '../types/app';
import {BASE_QUESTIONS, selectNonRepeatingRoundQuestions} from '../data/questions';
import {soundEngine} from '../services/sound';

interface QuizTabProps {
  role: PartnerRole;
  settings: EncryptedRoomSettings;
  quizState: QuizRoundState | null;
  onUpdateQuiz: (next: QuizRoundState) => Promise<void>;
  onUpdateSettings: (next: EncryptedRoomSettings) => Promise<void>;
  onTriggerReaction: (event: ReactionEvent) => Promise<void>;
}

const CATEGORIES: Array<{id: QuizCategory | 'all'; label: string}> = [
  {id: 'all', label: 'شاملة'},
  {id: 'arts', label: 'فنية'},
  {id: 'history', label: 'تاريخية'},
  {id: 'sports', label: 'رياضية'},
];

const QUESTION_SECONDS = 30;

export const QuizTab: React.FC<QuizTabProps> = ({
  role,
  settings,
  quizState,
  onUpdateQuiz,
  onUpdateSettings,
  onTriggerReaction,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<QuizCategory | 'all'>('all');
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);

  const allQuestions = useMemo(
    () => [...BASE_QUESTIONS, ...(settings.customQuestions || [])],
    [settings.customQuestions]
  );

  const unseenCount = useMemo(() => {
    const asked = new Set(settings.askedQuestionIds || []);
    return allQuestions.filter((q) =>
      selectedCategory === 'all' ? !asked.has(q.id) : q.category === selectedCategory && !asked.has(q.id)
    ).length;
  }, [allQuestions, settings.askedQuestionIds, selectedCategory]);

  // Countdown timer synced to questionStartedAt
  useEffect(() => {
    if (!quizState || quizState.status !== 'playing') return;

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - quizState.questionStartedAt) / 1000);
      const rem = Math.max(0, QUESTION_SECONDS - elapsed);
      setSecondsLeft(rem);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [quizState]);

  const currentQuestion: QuizQuestion | undefined =
    quizState && quizState.status === 'playing'
      ? quizState.questions[quizState.currentIndex]
      : undefined;

  const myAnswer =
    quizState && quizState.status === 'playing'
      ? role === 'male'
        ? quizState.maleAnswers?.[quizState.currentIndex]
        : quizState.femaleAnswers?.[quizState.currentIndex]
      : undefined;

  const partnerAnswer =
    quizState && quizState.status === 'playing'
      ? role === 'male'
        ? quizState.femaleAnswers?.[quizState.currentIndex]
        : quizState.maleAnswers?.[quizState.currentIndex]
      : undefined;

  // Auto-advance when timer hits 0 (startedBy client acts as coordinator to avoid double-writes)
  useEffect(() => {
    if (!quizState || quizState.status !== 'playing') return;
    if (secondsLeft > 0) return;
    if (quizState.startedBy !== role) return;

    const timer = setTimeout(() => {
      handleAdvanceQuestion();
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, quizState?.status, quizState?.currentIndex]);

  const handleGenerateQuestions = async () => {
    setGenerating(true);
    setGenMessage(null);
    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          category: selectedCategory,
          excludeTopics: allQuestions.slice(-60).map((q) => q.question),
        }),
      });
      const data = (await res.json()) as {
        questions?: QuizQuestion[];
        error?: string;
      };
      if (!res.ok || !data.questions) {
        throw new Error(data.error || 'تعذر توليد أسئلة جديدة.');
      }

      const nextCustom = [...(settings.customQuestions || []), ...data.questions];
      await onUpdateSettings({
        ...settings,
        customQuestions: nextCustom,
      });
      setGenMessage(`تمت إضافة ${data.questions.length} سؤالاً جديداً وتشفيرها بنجاح.`);
    } catch (err) {
      setGenMessage(
        err instanceof Error ? err.message : 'حدث خطأ أثناء الاتصال بخدمة Gemini.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleStartRound = async () => {
    setGenMessage(null);
    const {selected, exhausted} = selectNonRepeatingRoundQuestions(
      allQuestions,
      settings.askedQuestionIds || [],
      selectedCategory,
      10
    );

    if (exhausted || selected.length < 10) {
      setGenMessage(
        'نفدت الأسئلة غير المكررة في هذا التصنيف! اضغط "توليد أسئلة جديدة" لإضافة 100 سؤال جديد.'
      );
      return;
    }

    const nextAsked = Array.from(
      new Set([...(settings.askedQuestionIds || []), ...selected.map((q) => q.id)])
    );

    await onUpdateSettings({
      ...settings,
      askedQuestionIds: nextAsked,
    });

    await onUpdateQuiz({
      roundId: `quiz_${Date.now()}`,
      status: 'playing',
      category: selectedCategory,
      startedBy: role,
      questions: selected,
      currentIndex: 0,
      questionStartedAt: Date.now(),
      maleScore: 0,
      femaleScore: 0,
      maleAnswers: {},
      femaleAnswers: {},
      updatedAt: Date.now(),
    });
  };

  const handleSelectOption = async (optionIdx: number) => {
    if (!quizState || quizState.status !== 'playing' || !currentQuestion) return;
    if (myAnswer || secondsLeft <= 0) return;

    const isCorrect = optionIdx === currentQuestion.correctIndex;
    const idx = quizState.currentIndex;

    const record = {
      questionIndex: idx,
      selectedOption: optionIdx,
      isCorrect,
      answeredAt: Date.now(),
    };

    const nextMaleAnswers =
      role === 'male'
        ? {...(quizState.maleAnswers || {}), [idx]: record}
        : quizState.maleAnswers || {};
    const nextFemaleAnswers =
      role === 'female'
        ? {...(quizState.femaleAnswers || {}), [idx]: record}
        : quizState.femaleAnswers || {};

    const nextMaleScore = Object.values(nextMaleAnswers).filter((a) => a.isCorrect).length;
    const nextFemaleScore = Object.values(nextFemaleAnswers).filter((a) => a.isCorrect).length;

    if (isCorrect) {
      soundEngine.playWin();
    } else {
      soundEngine.playSad();
    }

    // Trigger transparent animated character popup on BOTH screens simultaneously
    await onTriggerReaction({
      id: `react_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: isCorrect ? 'happy' : 'sad',
      triggeredBy: role,
      label: isCorrect
        ? `إجابة صحيحة! (${role === 'male' ? 'الذكر' : 'الأنثى'}) 💋`
        : `إجابة خاطئة (${role === 'male' ? 'الذكر' : 'الأنثى'})`,
      timestamp: Date.now(),
    });

    await onUpdateQuiz({
      ...quizState,
      maleScore: nextMaleScore,
      femaleScore: nextFemaleScore,
      maleAnswers: nextMaleAnswers,
      femaleAnswers: nextFemaleAnswers,
      updatedAt: Date.now(),
    });
  };

  const handleAdvanceQuestion = async () => {
    if (!quizState || quizState.status !== 'playing') return;
    const nextIndex = quizState.currentIndex + 1;

    if (nextIndex >= quizState.questions.length) {
      const m = quizState.maleScore;
      const f = quizState.femaleScore;
      let winnerRole: PartnerRole | 'tie' = 'tie';
      let loserRole: PartnerRole | 'tie' = 'tie';
      if (m > f) {
        winnerRole = 'male';
        loserRole = 'female';
      } else if (f > m) {
        winnerRole = 'female';
        loserRole = 'male';
      }

      await onUpdateQuiz({
        ...quizState,
        status: 'finished',
        winnerRole,
        loserRole,
        updatedAt: Date.now(),
      });
    } else {
      await onUpdateQuiz({
        ...quizState,
        currentIndex: nextIndex,
        questionStartedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  };

  const handleSelectReward = async (btn: QuizRewardButton) => {
    if (!quizState || quizState.status !== 'finished') return;
    soundEngine.playKissPing();
    await onUpdateQuiz({
      ...quizState,
      loserSelectedRewardId: btn.id,
      loserSelectedRewardLabel: btn.label,
      updatedAt: Date.now(),
    });
  };

  const handleResetToLobby = async () => {
    if (!quizState) return;
    await onUpdateQuiz({
      ...quizState,
      status: 'idle',
      updatedAt: Date.now(),
    });
  };

  if (quizState?.status === 'playing' && currentQuestion) {
    const bothAnswered = Boolean(myAnswer && partnerAnswer);
    return (
      <div className="flex h-full w-full flex-col justify-between gap-2 py-1">
        {/* Top Scoreboard & Timer */}
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-rose-200/25 bg-black/20 px-3 py-2 backdrop-blur-[2px] [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="text-sky-300">👨🏻 {quizState.maleScore}</span>
            <span className="text-rose-200/70">·</span>
            <span className="text-rose-200">👩🏻 {quizState.femaleScore}</span>
          </div>

          <span className="font-mono-num text-xs font-bold text-white">
            سؤال {quizState.currentIndex + 1} / {quizState.questions.length}
          </span>

          <div
            className={`font-mono-num flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-extrabold ${
              secondsLeft <= 7
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-black/30 text-amber-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{secondsLeft}s</span>
          </div>
        </div>

        {/* Question Card */}
        <div className="flex-1 flex flex-col justify-center rounded-2xl border border-rose-200/25 bg-black/20 p-3.5 backdrop-blur-[2px] [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">
          <div className="flex items-center justify-between text-[11px] text-rose-200/75 mb-2">
            <span>
              {currentQuestion.category === 'arts'
                ? 'فنية'
                : currentQuestion.category === 'history'
                  ? 'تاريخية'
                  : 'رياضية'}
            </span>
            <span>
              {currentQuestion.difficulty === 'easy'
                ? 'سهل'
                : currentQuestion.difficulty === 'medium'
                  ? 'متوسط'
                  : 'صعب'}
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-extrabold leading-relaxed text-white text-center mb-3">
            {currentQuestion.question}
          </h3>

          <div className="grid grid-cols-1 gap-2">
            {currentQuestion.options.map((opt, idx) => {
              const isMine = myAnswer?.selectedOption === idx;
              const isCorrectOpt = idx === currentQuestion.correctIndex;
              const reveal = Boolean(myAnswer) || secondsLeft <= 0;

              let btnClass =
                'border-rose-200/25 bg-black/25 text-white hover:bg-rose-500/35 [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]';
              if (reveal) {
                if (isCorrectOpt) {
                  btnClass =
                    'border-emerald-400 bg-emerald-600/85 text-white';
                } else if (isMine && !isCorrectOpt) {
                  btnClass =
                    'border-rose-400 bg-rose-700/85 text-white';
                } else {
                  btnClass =
                    'border-white/15 bg-black/20 text-rose-100/80';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={Boolean(myAnswer) || secondsLeft <= 0}
                  onClick={() => handleSelectOption(idx)}
                  className={`min-h-[44px] w-full rounded-xl border px-3 py-2 text-right text-xs sm:text-sm font-bold transition active:scale-[0.99] ${btnClass}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Advance Bar */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-rose-200/80">
            {bothAnswered
              ? 'أجاب الشريكان!'
              : myAnswer
                ? 'تم تسجيل إجابتك · بانتظار الشريك'
                : 'اختر الإجابة الصحيحة خلال 30 ثانية'}
          </span>
          {(myAnswer || secondsLeft <= 0) && (
            <button
              type="button"
              onClick={handleAdvanceQuestion}
              className="min-h-[40px] shrink-0 rounded-xl bg-amber-500 px-4 py-1.5 text-xs font-extrabold text-slate-950 shadow hover:bg-amber-400 active:scale-95 transition"
            >
              {quizState.currentIndex + 1 >= quizState.questions.length
                ? 'عرض النتيجة'
                : 'السؤال التالي'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (quizState?.status === 'finished') {
    const isLoser =
      quizState.loserRole === role || quizState.loserRole === 'tie';
    const winnerLabel =
      quizState.winnerRole === 'tie'
        ? 'تعادل رائع بينكما!'
        : quizState.winnerRole === 'male'
          ? 'الفائز: الذكر 👨🏻'
          : 'الفائزة: الأنثى 👩🏻';

    return (
      <div className="flex h-full w-full flex-col justify-between gap-2 py-1 inner-scroll">
        <div className="rounded-2xl border border-amber-300/30 bg-black/20 p-3.5 text-center backdrop-blur-[2px] [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">
          <Trophy className="mx-auto h-7 w-7 text-amber-300 mb-1" />
          <h3 className="text-base font-extrabold text-white">{winnerLabel}</h3>
          <div className="mt-2 flex items-center justify-center gap-6 text-sm font-bold">
            <span className="text-sky-300 font-mono-num">
              👨🏻 {quizState.maleScore} / 10
            </span>
            <span className="text-rose-300 font-mono-num">
              👩🏻 {quizState.femaleScore} / 10
            </span>
          </div>
        </div>

        <div className="flex-1 rounded-2xl border border-rose-200/25 bg-black/20 p-3 flex flex-col justify-between backdrop-blur-[2px] [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">
          <div>
            <p className="text-xs font-extrabold text-rose-200 text-center mb-2">
              {quizState.loserSelectedRewardLabel
                ? `تم اختيار التحدي الإلزامي: "${quizState.loserSelectedRewardLabel}"`
                : isLoser
                  ? 'التحدي الإلزامي: اختر أحد الخيارات التالية لتنفيذه:'
                  : 'بانتظار اختيار الشريك الخاسر لتحديه الإلزامي...'}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {(settings.quizRewards || []).map((btn) => {
                const chosen = quizState.loserSelectedRewardId === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    disabled={!isLoser}
                    onClick={() => handleSelectReward(btn)}
                    className={`min-h-[44px] rounded-xl border px-2.5 py-2 text-xs font-bold break-words leading-tight transition ${
                      chosen
                        ? 'border-amber-300 bg-rose-600 text-white shadow-lg'
                        : 'border-rose-300/25 bg-white/10 text-rose-50 hover:bg-rose-500/30 disabled:opacity-65'
                    }`}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetToLobby}
            className="mt-3 flex w-full min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white/25 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>جولة جديدة</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col justify-between gap-2.5 py-1 inner-scroll">
      {/* Rules Box */}
      <div className="rounded-2xl border border-rose-200/25 bg-black/20 p-3 backdrop-blur-[2px] [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">
        <div className="flex items-center gap-1.5 text-amber-200 mb-1.5">
          <Award className="h-4 w-4 shrink-0" />
          <h2 className="text-sm font-extrabold">قوانين مسابقة التحدي</h2>
        </div>
        <ul className="space-y-1 text-[11px] sm:text-xs text-white leading-relaxed">
          <li>• 10 أسئلة عشوائية متجددة في كل جولة (30 ثانية لكل سؤال).</li>
          <li>• الشريك صاحب الإجابات الصحيحة الأكثر يفوز بالجولة.</li>
          <li>• تحدٍ إلزامي: يختار الخاسر وينفذ أحد خيارات الفائز فوراً.</li>
        </ul>
      </div>

      {/* Category 4-Button Grid */}
      <div className="[text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">
        <div className="flex items-center justify-between text-[11px] font-semibold text-rose-100 mb-1.5">
          <span>اختر تصنيف الأسئلة:</span>
          <span className="font-mono-num">المتاح بدون تكرار: {unseenCount}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`min-h-[44px] rounded-xl border px-1 py-2 text-[11px] sm:text-xs font-bold leading-tight break-words transition ${
                selectedCategory === cat.id
                  ? 'border-rose-300 bg-rose-600 text-white shadow'
                  : 'border-rose-200/25 bg-black/20 text-white backdrop-blur-[2px] hover:bg-black/35'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {genMessage && (
        <div className="rounded-xl border border-amber-300/30 bg-amber-950/55 px-3 py-2 text-center text-[11px] font-semibold text-amber-100">
          {genMessage}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 mt-auto">
        <button
          type="button"
          onClick={handleStartRound}
          className="flex w-full min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg hover:from-rose-500 hover:to-rose-400 active:scale-[0.98] transition"
        >
          <Play className="h-4 w-4 fill-white" />
          <span>بدء جولة من 10 أسئلة</span>
        </button>

        <button
          type="button"
          disabled={generating}
          onClick={handleGenerateQuestions}
          className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-2xl border border-amber-300/35 bg-amber-500/15 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/25 active:scale-[0.98] transition disabled:opacity-60"
        >
          <Sparkles className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
          <span>
            {generating
              ? 'جاري توليد 100 سؤال جديد بالذكاء الاصطناعي...'
              : 'توليد أسئلة جديدة (100 سؤال بدون تكرار)'}
          </span>
        </button>
      </div>
    </div>
  );
};
