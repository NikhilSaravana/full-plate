import React from 'react';

const FOOD_EMOJIS = ['🍎', '🍞', '🥕', '🧀', '🍇', '🍌', '🍉', '🥦', '🍓', '🍊', '🥚', '🥨', '🥬', '🍅', '🥔'];

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const CARD_WIDTH = 400;
const CARD_HEIGHT = 500;

function isInCardArea(leftPercent) {
  const vw = window.innerWidth;
  const cardLeftPx = (vw - CARD_WIDTH) / 2;
  const cardRightPx = (vw + CARD_WIDTH) / 2;
  const leftPx = (leftPercent / 100) * vw;
  return leftPx > cardLeftPx && leftPx < cardRightPx;
}

const FoodBackground = ({ count = 18 }) => {
  // Fixed positions for consistent layout across refreshes
  const fixedPositions = [
    { emoji: '🍎', left: 15, top: 20, size: 32 },
    { emoji: '🍞', left: 85, top: 25, size: 28 },
    { emoji: '🥕', left: 25, top: 45, size: 36 },
    { emoji: '🧀', left: 75, top: 50, size: 30 },
    { emoji: '🍇', left: 10, top: 70, size: 34 },
    { emoji: '🍌', left: 90, top: 75, size: 26 },
    { emoji: '🍉', left: 35, top: 15, size: 38 },
    { emoji: '🥦', left: 65, top: 35, size: 32 },
    { emoji: '🍓', left: 20, top: 60, size: 28 },
    { emoji: '🍊', left: 80, top: 65, size: 30 },
    { emoji: '🥚', left: 45, top: 30, size: 26 },
    { emoji: '🥨', left: 55, top: 80, size: 34 },
    { emoji: '🥬', left: 5, top: 40, size: 32 },
    { emoji: '🍅', left: 95, top: 40, size: 28 },
    { emoji: '🥔', left: 30, top: 85, size: 30 },
    { emoji: '🍎', left: 70, top: 10, size: 36 },
    { emoji: '🍞', left: 40, top: 55, size: 28 },
    { emoji: '🥕', left: 60, top: 20, size: 32 }
  ];

  const emojis = fixedPositions.slice(0, count);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {/* Professional gradient background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        background: 'linear-gradient(135deg, #293c47 0%, #1a2a35 50%, #293c47 100%)',
      }} />
      {/* Subtle overlay pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1,
        background: 'radial-gradient(circle at 20% 80%, rgba(196, 164, 100, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(196, 164, 100, 0.08) 0%, transparent 50%)',
      }} />
      {emojis.map(({ emoji, left, top, size, key }) => (
        <span
          key={key}
          style={{
            position: 'absolute',
            left: `${left}%`,
            top: `${top}%`,
            fontSize: `${size}px`,
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
            userSelect: 'none',
            opacity: 0.4,
            zIndex: 1,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
};

export default React.memo(FoodBackground); 