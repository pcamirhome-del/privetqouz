import React, {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {PartnerRole} from '../types/app';

interface CharacterSvgProps {
  mood: 'entrance' | 'happy' | 'sad';
  role?: PartnerRole;
  phase?: 'wave' | 'dance' | 'kiss' | 'walk';
}

const DisneyPrincessSvg: React.FC<CharacterSvgProps> = ({
  mood,
  phase = 'dance',
}) => {
  const isSad = mood === 'sad';
  const gownLight = isSad ? '#64748b' : '#f43f5e';
  const gownMid = isSad ? '#475569' : '#e11d48';
  const gownDark = isSad ? '#334155' : '#9f1239';
  const tulleColor = isSad ? '#cbd5e1' : '#ffe4e6';
  const goldAccent = isSad ? '#94a3b8' : '#fbbf24';

  return (
    <svg
      viewBox="0 0 200 250"
      className="w-full h-full drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="princessSkin" cx="50%" cy="38%" r="58%">
          <stop offset="0%" stopColor="#ffe5d4" />
          <stop offset="100%" stopColor="#f3be9e" />
        </radialGradient>
        <linearGradient id="princessHair" x1="30" y1="20" x2="170" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5c2419" />
          <stop offset="50%" stopColor="#3e160f" />
          <stop offset="100%" stopColor="#260c08" />
        </linearGradient>
        <linearGradient id="gownGrad" x1="100" y1="100" x2="100" y2="232" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={gownLight} />
          <stop offset="55%" stopColor={gownMid} />
          <stop offset="100%" stopColor={gownDark} />
        </linearGradient>
        <linearGradient id="tiaraGold" x1="75" y1="14" x2="125" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>

      {/* Soft Ground Shadow */}
      <ellipse cx="100" cy="238" rx="48" ry="7" fill="rgba(0,0,0,0.3)" />

      {/* Back Flowing Princess Hair */}
      <motion.path
        d="M64 62 C44 88, 38 128, 52 152 C68 158, 132 158, 148 152 C162 128, 156 88, 136 62 Z"
        fill="url(#princessHair)"
        animate={
          phase === 'dance' || mood === 'happy'
            ? {rotate: [-2.5, 2.5, -2.5]}
            : {rotate: [-1, 1, -1]}
        }
        transition={{duration: 1.4, repeat: Infinity, ease: 'easeInOut'}}
        style={{originX: '100px', originY: '62px'}}
      />

      {/* Glass / Golden Slippers peeking under gown */}
      <motion.g
        animate={
          phase === 'walk'
            ? {x: [-4, 4, -4]}
            : phase === 'dance'
              ? {y: [0, -3, 0]}
              : {}
        }
        transition={{duration: 0.45, repeat: Infinity, ease: 'easeInOut'}}
      >
        <ellipse cx="82" cy="232" rx="11" ry="5" fill={goldAccent} />
        <ellipse cx="118" cy="232" rx="11" ry="5" fill={goldAccent} />
      </motion.g>

      {/* Princess Torso & Flowing Ballgown with Hip-Sway */}
      <motion.g
        animate={
          isSad
            ? {y: [0, 3, 0], rotate: [-1.5, 0, -1.5]}
            : phase === 'dance' || mood === 'happy'
              ? {rotate: [-5.5, 5.5, -5.5], x: [-3, 3, -3]}
              : {rotate: [-1.8, 1.8, -1.8]}
        }
        transition={{
          duration: isSad ? 1.8 : 0.75,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{originX: '100px', originY: '138px'}}
      >
        {/* Sweetheart Bodice */}
        <path
          d="M78 104 C84 96, 94 98, 100 105 C106 98, 116 96, 122 104 L116 140 L84 140 Z"
          fill={gownDark}
          stroke={goldAccent}
          strokeWidth="1.8"
        />

        {/* Puffed Princess Sleeves */}
        <circle cx="74" cy="108" r="10" fill={tulleColor} stroke={goldAccent} strokeWidth="1.4" />
        <circle cx="126" cy="108" r="10" fill={tulleColor} stroke={goldAccent} strokeWidth="1.4" />

        {/* Sweeping Ballgown Skirt */}
        <path
          d="M84 138 L116 138 C142 162, 162 198, 158 226 C138 236, 62 236, 42 226 C38 198, 58 162, 84 138 Z"
          fill="url(#gownGrad)"
        />

        {/* Scalloped Tulle Overskirt Drape */}
        <path
          d="M84 138 Q100 165 116 138 Q128 166 136 178 Q118 188 100 174 Q82 188 64 178 Q72 166 84 138 Z"
          fill={tulleColor}
          opacity="0.92"
        />

        {/* Gown Gold Trim & Sparkles */}
        <path
          d="M46 222 Q100 232 154 222"
          stroke={goldAccent}
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.85"
        />
        {!isSad && (
          <>
            <circle cx="75" cy="196" r="2" fill="#fef08a" opacity="0.9" />
            <circle cx="125" cy="202" r="2.2" fill="#fef08a" opacity="0.9" />
            <circle cx="100" cy="212" r="1.8" fill="#ffffff" opacity="0.85" />
          </>
        )}

        {/* Left Arm with Long Satin Glove (Waving / Blowing Kiss) */}
        <motion.g
          animate={
            isSad
              ? {rotate: 12}
              : phase === 'wave'
                ? {rotate: [-16, -54, -14, -52, -16]}
                : phase === 'kiss' || mood === 'happy'
                  ? {rotate: [-46, -24, -46]}
                  : {rotate: [-10, 10, -10]}
          }
          transition={{
            duration: phase === 'wave' ? 0.65 : 0.85,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{originX: '72px', originY: '108px'}}
        >
          <path
            d="M72 108 C54 114, 46 96, 42 78"
            stroke="#ffe5d4"
            strokeWidth="8.5"
            strokeLinecap="round"
          />
          <path
            d="M55 103 C47 96, 44 86, 42 78"
            stroke="#fff7ed"
            strokeWidth="9.5"
            strokeLinecap="round"
          />
          <circle cx="41" cy="76" r="5.5" fill="#fff7ed" />
        </motion.g>

        {/* Right Arm with Long Satin Glove */}
        <motion.g
          animate={
            isSad
              ? {rotate: -12}
              : phase === 'dance' || mood === 'happy'
                ? {rotate: [14, -18, 14]}
                : {rotate: [8, -8, 8]}
          }
          transition={{duration: 0.75, repeat: Infinity, ease: 'easeInOut'}}
          style={{originX: '128px', originY: '108px'}}
        >
          <path
            d="M128 108 C144 118, 152 134, 146 148"
            stroke="#ffe5d4"
            strokeWidth="8.5"
            strokeLinecap="round"
          />
          <path
            d="M141 124 C149 132, 150 140, 146 148"
            stroke="#fff7ed"
            strokeWidth="9.5"
            strokeLinecap="round"
          />
          <circle cx="146" cy="150" r="5.5" fill="#fff7ed" />
        </motion.g>

        {/* Neck & Head */}
        <motion.g
          animate={isSad ? {y: 4, rotate: -4} : {rotate: [-2.5, 2.5, -2.5]}}
          transition={{duration: 1.2, repeat: Infinity, ease: 'easeInOut'}}
          style={{originX: '100px', originY: '92px'}}
        >
          {/* Delicate Neck */}
          <rect x="93" y="84" width="14" height="18" rx="6" fill="#f3be9e" />
          {/* Pearl Necklace */}
          <path
            d="M92 98 Q100 103 108 98"
            stroke="#fff7ed"
            strokeWidth="2.5"
            strokeDasharray="1 3.5"
            strokeLinecap="round"
          />

          {/* Princess Face (Oval Disney Silhouette) */}
          <path
            d="M72 58 C72 34, 128 34, 128 58 C128 78, 114 91, 100 91 C86 91, 72 78, 72 58 Z"
            fill="url(#princessSkin)"
          />

          {/* Side Hair Waves / Bangs */}
          <path
            d="M70 58 C68 32, 92 22, 104 28 C88 32, 78 44, 73 62 Z"
            fill="url(#princessHair)"
          />
          <path
            d="M130 58 C132 32, 108 22, 96 28 C112 32, 122 44, 127 62 Z"
            fill="url(#princessHair)"
          />

          {/* Sparkling Golden Tiara */}
          <path
            d="M80 33 L85 20 L93 27 L100 13 L107 27 L115 20 L120 33 Z"
            fill="url(#tiaraGold)"
            stroke="#92400e"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <circle cx="100" cy="24" r="2.8" fill="#e11d48" />
          <circle cx="88" cy="28" r="1.6" fill="#fffbeb" />
          <circle cx="112" cy="28" r="1.6" fill="#fffbeb" />

          {/* Rosy Princess Cheeks */}
          <ellipse cx="81" cy="68" rx="6" ry="3.2" fill="#fb7185" opacity={isSad ? 0.15 : 0.45} />
          <ellipse cx="119" cy="68" rx="6" ry="3.2" fill="#fb7185" opacity={isSad ? 0.15 : 0.45} />

          {/* Delicate Nose */}
          <path d="M99 63 Q101 66 99 68" stroke="#d99b78" strokeWidth="1.5" strokeLinecap="round" />

          {/* Large Expressive Disney Princess Eyes */}
          {isSad ? (
            <>
              {/* Sad eyebrows */}
              <path d="M78 52 Q85 48 91 52" stroke="#3e160f" strokeWidth="2" strokeLinecap="round" />
              <path d="M109 52 Q115 48 122 52" stroke="#3e160f" strokeWidth="2" strokeLinecap="round" />
              {/* Closed sad eyes */}
              <path d="M80 59 Q86 63 92 59" stroke="#1e293b" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M108 59 Q114 63 120 59" stroke="#1e293b" strokeWidth="2.6" strokeLinecap="round" />
              {/* Glistening tear */}
              <motion.path
                d="M116 64 C116 64, 120 71, 116 74 C112 71, 116 64, 116 64 Z"
                fill="#38bdf8"
                animate={{y: [0, 8, 0], opacity: [0.95, 0.4, 0.95]}}
                transition={{duration: 1.4, repeat: Infinity}}
              />
            </>
          ) : (
            <>
              {/* Arched eyebrows */}
              <path d="M79 49 Q86 46 92 49" stroke="#3e160f" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M108 49 Q114 46 121 49" stroke="#3e160f" strokeWidth="1.8" strokeLinecap="round" />
              {/* Sclera */}
              <ellipse cx="86" cy="58" rx="6.5" ry="7.2" fill="#ffffff" />
              <ellipse cx="114" cy="58" rx="6.5" ry="7.2" fill="#ffffff" />
              {/* Royal Emerald/Sapphire Iris */}
              <circle cx="86.5" cy="58.5" r="4.4" fill="#0284c7" />
              <circle cx="113.5" cy="58.5" r="4.4" fill="#0284c7" />
              {/* Pupil + Sparkle */}
              <circle cx="86.5" cy="58.5" r="2.2" fill="#0f172a" />
              <circle cx="113.5" cy="58.5" r="2.2" fill="#0f172a" />
              <circle cx="88" cy="56.5" r="1.4" fill="#ffffff" />
              <circle cx="115" cy="56.5" r="1.4" fill="#ffffff" />
              {/* Upper Eyelashes */}
              <path d="M78 55 Q86 49 93 55" stroke="#1f1215" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M107 55 Q114 49 122 55" stroke="#1f1215" strokeWidth="2.4" strokeLinecap="round" />
            </>
          )}

          {/* Ruby Princess Lips */}
          {isSad ? (
            <path
              d="M93 79 Q100 73 107 79"
              stroke="#9f1239"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          ) : phase === 'kiss' || mood === 'happy' ? (
            <circle cx="100" cy="77" r="4" fill="#e11d48" />
          ) : (
            <path
              d="M92 75 Q100 83 108 75"
              stroke="#e11d48"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          )}
        </motion.g>
      </motion.g>
    </svg>
  );
};

export const EntranceCharacterOverlay: React.FC<{
  role: PartnerRole;
  onDismiss?: () => void;
}> = ({role}) => {
  const [phase, setPhase] = useState<'wave' | 'dance' | 'kiss' | 'walk'>('wave');
  const [side, setSide] = useState<'right' | 'left'>('right');

  useEffect(() => {
    const cycle = [
      {p: 'wave' as const, ms: 2200},
      {p: 'dance' as const, ms: 2400},
      {p: 'kiss' as const, ms: 2000},
      {p: 'walk' as const, ms: 2600},
    ];
    let idx = 0;
    let timer: ReturnType<typeof setTimeout>;

    const advance = () => {
      idx = (idx + 1) % cycle.length;
      const next = cycle[idx];
      setPhase(next.p);
      if (next.p === 'wave') {
        setSide((prev) => (prev === 'right' ? 'left' : 'right'));
      }
      timer = setTimeout(advance, next.ms);
    };

    timer = setTimeout(advance, cycle[0].ms);
    return () => clearTimeout(timer);
  }, []);

  // Positioned strictly at far-right and far-left edges, pointer-events-none so buttons are 100% unobstructed
  const targetX =
    side === 'right'
      ? phase === 'walk'
        ? 'calc(-100vw + 100% + 4px)'
        : '0px'
      : phase === 'walk'
        ? '0px'
        : 'calc(-100vw + 100% + 4px)';

  return (
    <div className="pointer-events-none fixed bottom-1 inset-x-0 z-30 h-28 overflow-hidden">
      <motion.div
        animate={{x: targetX}}
        transition={{
          duration: phase === 'walk' ? 2.5 : 0.5,
          ease: 'easeInOut',
        }}
        className="pointer-events-none absolute bottom-0 right-1 w-20 h-26 sm:w-24 sm:h-30"
      >
        <AnimatePresence>
          {phase === 'kiss' && (
            <>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  initial={{opacity: 0, scale: 0.4, x: 0, y: 16}}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0.5, 1.2, 0.85],
                    x: side === 'right' ? -36 - i * 18 : 36 + i * 18,
                    y: -20 - i * 15,
                  }}
                  exit={{opacity: 0}}
                  transition={{duration: 1.3, delay: i * 0.22}}
                  className="absolute top-5 left-1/2 text-lg select-none"
                >
                  ❤️
                </motion.span>
              ))}
            </>
          )}
        </AnimatePresence>

        <DisneyPrincessSvg mood="entrance" role={role} phase={phase} />
      </motion.div>
    </div>
  );
};

export const ReactionPopupOverlay: React.FC<{
  type: 'happy' | 'sad' | 'kiss' | null;
  label?: string;
  role?: PartnerRole;
}> = ({type, label, role = 'female'}) => {
  const isSad = type === 'sad';

  return (
    <AnimatePresence>
      {type && (
        <motion.div
          initial={{opacity: 0, x: isSad ? -30 : 30, scale: 0.75}}
          animate={{opacity: 1, x: 0, scale: 1}}
          exit={{opacity: 0, scale: 0.75}}
          transition={{duration: 0.28, ease: [0.16, 1, 0.3, 1]}}
          className={`pointer-events-none fixed bottom-14 z-50 flex flex-col items-center bg-transparent ${
            isSad ? 'left-1.5' : 'right-1.5'
          }`}
        >
          <div className="relative w-24 h-32 sm:w-28 sm:h-36 flex flex-col items-center justify-center">
            {!isSad && (
              <div className="absolute inset-0 pointer-events-none">
                {[0, 1, 2, 3].map((i) => (
                  <motion.span
                    key={i}
                    initial={{opacity: 0, scale: 0.4, y: 12, x: 0}}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0.6, 1.25, 0.9],
                      y: -55 - i * 12,
                      x: -20 - i * 16,
                    }}
                    transition={{duration: 1.4, delay: i * 0.12}}
                    className="absolute top-6 left-4 text-xl"
                  >
                    {i % 2 === 0 ? '💋' : '❤️'}
                  </motion.span>
                ))}
              </div>
            )}

            <DisneyPrincessSvg
              mood={isSad ? 'sad' : 'happy'}
              role={role}
              phase={isSad ? 'dance' : 'kiss'}
            />

            {label && (
              <div
                className={`mt-0.5 max-w-[140px] px-2.5 py-1 rounded-xl text-[10px] font-bold text-center shadow-lg backdrop-blur-md ${
                  isSad
                    ? 'bg-slate-900/85 text-slate-100 border border-slate-400/30'
                    : 'bg-rose-600/90 text-white border border-rose-300/40'
                }`}
              >
                {label}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
