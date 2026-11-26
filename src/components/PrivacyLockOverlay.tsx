import React, {useEffect, useState} from 'react';
import {Delete, Lock} from 'lucide-react';

interface PrivacyLockOverlayProps {
  isLocked: boolean;
  validPins: string[];
  onUnlock: () => void;
}

export const PrivacyLockOverlay: React.FC<PrivacyLockOverlayProps> = ({
  isLocked,
  validPins,
  onUnlock,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<string | null>(null);
  const [resetNext, setResetNext] = useState(false);
  const [pinBuffer, setPinBuffer] = useState('');
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [promptPin, setPromptPin] = useState('');
  const [promptError, setPromptError] = useState(false);

  useEffect(() => {
    if (!isLocked) return;
    setNow(new Date());
    setDisplay('0');
    setStoredValue(null);
    setPendingOp(null);
    setResetNext(false);
    setPinBuffer('');
    setShowPinPrompt(false);
    setPromptPin('');
    setPromptError(false);

    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isLocked]);

  if (!isLocked) return null;

  const isValidPin = (candidate: string) =>
    validPins.some((p) => p && p === candidate.trim());

  const compute = (a: number, b: number, op: string): number => {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? 0 : a / b;
    return b;
  };

  const handleDigit = (digit: string) => {
    setPinBuffer((prev) => `${prev}${digit}`.slice(-8));
    if (resetNext || display === '0') {
      setDisplay(digit === '.' ? '0.' : digit);
      setResetNext(false);
    } else {
      if (digit === '.' && display.includes('.')) return;
      setDisplay((prev) => (prev.length >= 12 ? prev : `${prev}${digit}`));
    }
  };

  const handleOperator = (op: string) => {
    setPinBuffer('');
    const current = parseFloat(display) || 0;
    if (storedValue === null) {
      setStoredValue(current);
    } else if (pendingOp && !resetNext) {
      const res = compute(storedValue, current, pendingOp);
      setStoredValue(res);
      setDisplay(String(Number(res.toFixed(6))));
    }
    setPendingOp(op);
    setResetNext(true);
  };

  const handleEquals = () => {
    if (isValidPin(pinBuffer) || isValidPin(display)) {
      onUnlock();
      return;
    }
    setPinBuffer('');
    if (storedValue !== null && pendingOp) {
      const current = parseFloat(display) || 0;
      const res = compute(storedValue, current, pendingOp);
      setDisplay(String(Number(res.toFixed(6))));
      setStoredValue(null);
      setPendingOp(null);
      setResetNext(true);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setStoredValue(null);
    setPendingOp(null);
    setResetNext(false);
    setPinBuffer('');
  };

  const handleBackspace = () => {
    setPinBuffer((prev) => prev.slice(0, -1));
    setDisplay((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  };

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidPin(promptPin)) {
      onUnlock();
    } else {
      setPromptError(true);
      setPromptPin('');
    }
  };

  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      dir="ltr"
      className="fixed inset-0 z-[90] flex flex-col justify-between bg-slate-950 text-slate-100 p-4 select-none overflow-hidden"
    >
      {/* Stealth Digital Clock Header */}
      <div className="mx-auto flex w-full max-w-sm items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setShowPinPrompt((v) => !v)}
          className="text-left focus:outline-none"
          aria-label="Clock"
        >
          <div className="font-mono-num text-3xl font-bold tracking-wider text-white">
            {timeStr}
          </div>
          <div className="text-xs font-medium text-slate-400">{dateStr}</div>
        </button>

        <button
          type="button"
          onClick={() => setShowPinPrompt((v) => !v)}
          aria-label="Unlock"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800 transition"
        >
          <Lock className="h-4 w-4" />
        </button>
      </div>

      {/* Optional Discreet PIN Prompt triggered by tapping clock or lock */}
      {showPinPrompt && (
        <form
          onSubmit={handlePromptSubmit}
          className="mx-auto flex w-full max-w-sm items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-2.5 shadow-xl"
        >
          <input
            type="password"
            inputMode="numeric"
            value={promptPin}
            onChange={(e) => {
              setPromptError(false);
              setPromptPin(e.target.value.replace(/\D/g, ''));
            }}
            placeholder={promptError ? 'Invalid' : 'PIN'}
            autoFocus
            className="font-mono-num flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-center text-sm font-bold tracking-[0.3em] text-white focus:border-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            className="min-h-[38px] rounded-xl bg-slate-700 px-3.5 text-xs font-bold text-white hover:bg-slate-600"
          >
            OK
          </button>
        </form>
      )}

      {/* Functional Basic Calculator Body */}
      <div className="mx-auto w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/90 p-4 shadow-2xl space-y-3 mb-2">
        <div className="rounded-2xl bg-slate-950 px-4 py-4 text-right border border-slate-800/80">
          <div className="h-4 text-xs font-mono-num text-slate-500">
            {storedValue !== null && pendingOp ? `${storedValue} ${pendingOp}` : ''}
          </div>
          <div className="font-mono-num text-3xl font-bold text-white truncate">
            {display}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="h-13 rounded-2xl bg-slate-800 text-sm font-bold text-amber-400 hover:bg-slate-700 active:scale-95 transition"
          >
            C
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Backspace"
            className="flex h-13 items-center justify-center rounded-2xl bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95 transition"
          >
            <Delete className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleOperator('÷')}
            className="h-13 rounded-2xl bg-slate-800 text-lg font-bold text-sky-400 hover:bg-slate-700 active:scale-95 transition"
          >
            ÷
          </button>
          <button
            type="button"
            onClick={() => handleOperator('×')}
            className="h-13 rounded-2xl bg-slate-800 text-lg font-bold text-sky-400 hover:bg-slate-700 active:scale-95 transition"
          >
            ×
          </button>

          {['7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="h-13 rounded-2xl bg-slate-800/70 text-lg font-semibold text-white hover:bg-slate-700 active:scale-95 transition"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('-')}
            className="h-13 rounded-2xl bg-slate-800 text-lg font-bold text-sky-400 hover:bg-slate-700 active:scale-95 transition"
          >
            −
          </button>

          {['4', '5', '6'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="h-13 rounded-2xl bg-slate-800/70 text-lg font-semibold text-white hover:bg-slate-700 active:scale-95 transition"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('+')}
            className="h-13 rounded-2xl bg-slate-800 text-lg font-bold text-sky-400 hover:bg-slate-700 active:scale-95 transition"
          >
            +
          </button>

          {['1', '2', '3'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="h-13 rounded-2xl bg-slate-800/70 text-lg font-semibold text-white hover:bg-slate-700 active:scale-95 transition"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={handleEquals}
            className="row-span-2 rounded-2xl bg-sky-600 text-xl font-bold text-white hover:bg-sky-500 active:scale-95 transition"
          >
            =
          </button>

          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="col-span-2 h-13 rounded-2xl bg-slate-800/70 text-lg font-semibold text-white hover:bg-slate-700 active:scale-95 transition"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleDigit('.')}
            className="h-13 rounded-2xl bg-slate-800/70 text-lg font-semibold text-white hover:bg-slate-700 active:scale-95 transition"
          >
            .
          </button>
        </div>
      </div>
    </div>
  );
};
