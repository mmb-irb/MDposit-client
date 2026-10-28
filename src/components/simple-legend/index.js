import React from 'react';
import { useTheme } from '@mui/material/styles';

// Expected input format is entires =
//  [
//    {
//      label: 'hello',
//      color: 'black',
//    }
//  ]

const SimpleLegend = ({ entries, className, sortValue = false }) => {
  const theme = useTheme();
  if (sortValue) {
    entries = [...entries].sort((a, b) => b.value - a.value);
  }
  return (
    <div className={className}>
      {entries.map(({ label, color, onClick, onMouseEnter, onMouseLeave, hidden, hovered }, i) => (
        <div
          key={i}
          style={{
            fontSize: 'clamp(0.8rem, 1vw, 2rem)',
            cursor: onClick ? 'pointer' : 'default',
            opacity: hidden ? 0.5 : hovered ? 1 : 0.88,
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.15rem 0.35rem',
            borderRadius: '0.35rem',
            backgroundColor: hovered ? theme.vars.palette.action.selected : 'transparent',
            transform: hovered ? 'translateX(2px)' : 'none',
            transition: 'background-color 120ms ease, opacity 120ms ease, transform 120ms ease',
          }}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <span
            style={{
              display: 'inline-block',
              height: '1em',
              width: '1em',
              backgroundColor: color,
              marginRight: '0.5em',
              fontSize: '20px',
              border: hovered
                ? `2px solid ${theme.vars.palette.text.primary}`
                : hidden ? `2px solid ${theme.vars.palette.text.disabled}` : 'none',
              boxShadow: hovered ? `0 0 0 2px ${theme.vars.palette.divider}` : 'none',
              filter: hidden ? 'grayscale(80%)' : hovered ? 'brightness(1.08)' : 'none',
            }}
          />
          {label}
        </div>
      ))}
    </div>
  );
};

export default SimpleLegend;
