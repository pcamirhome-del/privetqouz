import React, {useMemo} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {ScreenEffectEvent, ScreenEffectType} from '../types/app';

interface ScreenEffectOverlayProps {
  activeEffect: ScreenEffectEvent | null;
}

const EFFECT_SYMBOLS: Record<ScreenEffectType, string[]> = {
  kisses: ['💋', '😘', '❤️', '💋'],
  fire_hearts: ['🔥', '❤️‍🔥', '💥', '❤️'],
  roses: ['🌹', '🌷', '💐', '❤️'],
};

const EFFECT_LABEL: Record<ScreenEffectType, string> = {
  kisses: 'أمطار من القبلات 💋',
  fire_hearts: 'قلوب نارية مشتعلة 🔥',
  roses: 'باقة ورود حمراء لك 🌹',
};

export const ScreenEffectOverlay: React.FC<ScreenEffectOverlayProps> = ({
  activeEffect,
}) => {
  const particles = useMemo(() => {
    if (!activeEffect) return [];
    const symbols = EFFECT_SYMBOLS[activeEffect.effect];
    return Array.from({length: 28}, (_, i) => ({
      id: `${activeEffect.id}_${i}`,
      symbol: symbols[i % symbols.length],
      leftPct: 4 + ((i * 37) % 90),
      delay: (i % 9) * 0.18,
      duration: 2.3 + (i % 4) * 0.4,
      scale: 0.9 + (i % 3) * 0.35,
      sway: (i % 2 === 0 ? 1 : -1) * (16 + (i % 5) * 8),
    }));
  }, [activeEffect]);

  return (
    <AnimatePresence>
      {activeEffect && (
        <motion.div
          key={activeEffect.id}
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.3}}
          className="pointer-events-none fixed inset-0 z-[68] overflow-hidden"
        >
          {/* Floating Sender Banner */}
          <motion.div
            initial={{opacity: 0, y: -18, scale: 0.9}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: -12}}
            className="mx-auto mt-16 w-fit rounded-full border border-rose-300/45 bg-black/75 px-4 py-1.5 text-xs sm:text-sm font-extrabold text-amber-100 shadow-2xl backdrop-blur-md"
          >
            {activeEffect.sentBy === 'male' ? '👨🏻 الزوج: ' : '👩🏻 الزوجة: '}
            {EFFECT_LABEL[activeEffect.effect]}
          </motion.div>

          {/* Particle Shower */}
          {particles.map((p) => (
            <motion.span
              key={p.id}
              initial={{
                y: '105dvh',
                x: 0,
                opacity: 0,
                scale: p.scale * 0.6,
                rotate: -12,
              }}
              animate={{
                y: '-15dvh',
                x: [0, p.sway, -p.sway * 0.6, p.sway * 0.4],
                opacity: [0, 1, 1, 0],
                scale: [p.scale * 0.7, p.scale * 1.15, p.scale],
                rotate: [0, 18, -18, 10],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: 'easeOut',
              }}
              style={{left: `${p.leftPct}%`}}
              className="absolute top-0 text-2xl sm:text-3xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)] select-none"
            >
              {p.symbol}
            </motion.span>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
