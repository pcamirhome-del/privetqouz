import React, {useMemo} from 'react';
import {motion} from 'motion/react';

function LipStickerSvg({size = 38}: {size?: number}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="drop-shadow-[0_4px_10px_rgba(225,29,72,0.45)]"
    >
      {/* Upper lip */}
      <path
        d="M8 31C12 24 20 19 26 22C28.8 23.4 30.8 26 32 26C33.2 26 35.2 23.4 38 22C44 19 52 24 56 31C49 32.5 41 34 32 34C23 34 15 32.5 8 31Z"
        fill="url(#lipUpperGrad)"
        stroke="#881337"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Lower lip */}
      <path
        d="M9 32.5C15 44.5 23 48.5 32 48.5C41 48.5 49 44.5 55 32.5C46 35.2 38 35.8 32 35.8C26 35.8 18 35.2 9 32.5Z"
        fill="url(#lipLowerGrad)"
        stroke="#881337"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Glossy highlight */}
      <path
        d="M21 40.5C25 43.2 31 44 37 42.5"
        stroke="#FFE4E6"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.75"
      />
      <ellipse cx="22" cy="26" rx="3.2" ry="1.2" fill="#FFF1F2" opacity="0.55" />
      <defs>
        <linearGradient id="lipUpperGrad" x1="8" y1="20" x2="56" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FB7185" />
          <stop offset="0.5" stopColor="#E11D48" />
          <stop offset="1" stopColor="#BE123C" />
        </linearGradient>
        <linearGradient id="lipLowerGrad" x1="9" y1="32" x2="55" y2="49" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F43F5E" />
          <stop offset="0.5" stopColor="#E11D48" />
          <stop offset="1" stopColor="#9F1239" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function HeartStickerSvg({size = 28}: {size?: number}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="drop-shadow-[0_3px_8px_rgba(244,63,94,0.4)]"
    >
      <path
        d="M24 41.5C24 41.5 6 30.2 6 17.5C6 11.4 10.7 6.8 16.5 6.8C19.9 6.8 22.7 8.5 24 10.9C25.3 8.5 28.1 6.8 31.5 6.8C37.3 6.8 42 11.4 42 17.5C42 30.2 24 41.5 24 41.5Z"
        fill="url(#heartGrad)"
      />
      <path
        d="M14 14.5C15.2 12.2 17.6 11 19.6 11.4"
        stroke="#FFE4E6"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.7"
      />
      <defs>
        <linearGradient id="heartGrad" x1="6" y1="7" x2="42" y2="41" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF4D79" />
          <stop offset="1" stopColor="#BE123C" />
        </linearGradient>
      </defs>
    </svg>
  );
}

interface FloatingItem {
  id: number;
  kind: 'heart' | 'lips';
  xPercent: number;
  size: number;
  duration: number;
  delay: number;
  sway: number;
  rotate: number;
}

export const RomanticFloatingLayer: React.FC<{density?: 'normal' | 'rich'}> = ({
  density = 'normal',
}) => {
  const items = useMemo<FloatingItem[]>(() => {
    const count = density === 'rich' ? 16 : 10;
    return Array.from({length: count}, (_, i) => ({
      id: i,
      kind: i % 3 === 0 ? 'lips' : 'heart',
      xPercent: 5 + ((i * 19) % 88),
      size: i % 3 === 0 ? 34 + (i % 3) * 6 : 22 + (i % 4) * 5,
      duration: 9 + (i % 5) * 2.2,
      delay: (i % 6) * 1.1,
      sway: (i % 2 === 0 ? 1 : -1) * (16 + (i % 4) * 8),
      rotate: (i % 2 === 0 ? 1 : -1) * (10 + (i % 3) * 8),
    }));
  }, [density]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-10 overflow-hidden"
      aria-hidden="true"
    >
      {items.map((item) => (
        <motion.div
          key={item.id}
          initial={{
            y: '108dvh',
            x: `${item.xPercent}vw`,
            opacity: 0,
            scale: 0.75,
            rotate: -item.rotate,
          }}
          animate={{
            y: ['108dvh', '55dvh', '-12dvh'],
            x: [
              `${item.xPercent}vw`,
              `calc(${item.xPercent}vw + ${item.sway}px)`,
              `calc(${item.xPercent}vw - ${item.sway * 0.6}px)`,
            ],
            opacity: [0, 0.78, 0.72, 0],
            scale: [0.75, 1, 0.92],
            rotate: [-item.rotate, item.rotate, -item.rotate * 0.5],
          }}
          transition={{
            duration: item.duration,
            delay: item.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-0 left-0 will-change-transform"
        >
          {item.kind === 'lips' ? (
            <LipStickerSvg size={item.size} />
          ) : (
            <HeartStickerSvg size={item.size} />
          )}
        </motion.div>
      ))}
    </div>
  );
};
