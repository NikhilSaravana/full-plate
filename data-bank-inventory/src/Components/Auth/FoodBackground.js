import React from 'react';

const FOOD_EMOJIS = ['🍎', '🍞', '🥕', '🧀', '🍇', '🍌', '🍕', '🍉', '🥦', '🍪', '🍔', '🍓', '🍊', '🥚', '🥨'];

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
  const emojis = [];
  let attempts = 0;
  while (emojis.length < count && attempts < count * 10) {
    attempts++;
    const emoji = FOOD_EMOJIS[getRandomInt(0, FOOD_EMOJIS.length - 1)];
    const left = getRandomInt(0, 100); // percent
    const size = getRandomInt(28, 48); // px
    const duration = getRandomInt(7, 16); // seconds
    const delay = getRandomInt(0, 10); // seconds
    if (!isInCardArea(left)) {
      emojis.push({ emoji, left, size, duration, delay, key: emojis.length });
    }
  }

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
      {/* Pastel background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        background: 'linear-gradient(135deg, #e0f2fe 0%, #f0e7ff 100%)',
      }} />
      <style>{`
        @keyframes food-fall {
          0% { transform: translateY(-60px) rotate(0deg) scale(1); opacity: 0.7; }
          10% { opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg) scale(1.1); opacity: 0.8; }
        }
      `}</style>
      {emojis.map(({ emoji, left, size, duration, delay, key }) => (
        <span
          key={key}
          style={{
            position: 'absolute',
            left: `${left}%`,
            top: '-60px',
            fontSize: `${size}px`,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))',
            animation: `food-fall ${duration}s linear ${delay}s infinite`,
            userSelect: 'none',
            opacity: 0.85,
            zIndex: 1,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
};

export default FoodBackground; 