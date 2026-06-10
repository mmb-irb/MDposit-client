import React from 'react';

// Expected input format is entires =
//  [
//    {
//      label: 'hello',
//      color: 'black',
//    }
//  ]

const SimpleLegend = ({ entries, className, sortValue = false }) => {
  if (sortValue) {
    entries = [...entries].sort((a, b) => b.value - a.value);
  }
  return (
    <div className={className}>
      {entries.map(({ label, color, onClick, hidden }, i) => (
        <div
          key={i}
          style={{
            fontSize: 'clamp(0.8rem, 1vw, 2rem)',
            cursor: onClick ? 'pointer' : 'default',
            opacity: hidden ? 0.5 : 1,
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
          }}
          onClick={onClick}
        >
          <span
            style={{
              display: 'inline-block',
              height: '1em',
              width: '1em',
              backgroundColor: color,
              marginRight: '0.5em',
              fontSize: '20px',
              border: hidden ? '2px solid #888' : 'none',
              filter: hidden ? 'grayscale(80%)' : 'none',
            }}
          />
          {label}
        </div>
      ))}
    </div>
  );
};

export default SimpleLegend;
