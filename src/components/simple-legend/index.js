import React from 'react';

// Expected input format is entires =
//  [
//    {
//      label: 'hello',
//      color: 'black',
//    }
//  ]
const SimpleLegend = ({ entries, className }) => {
  return (
    <div className={className}>
      {entries.map(({ label, color }, i) => (
        <div key={i} style={{ fontSize: '20px' }}>
          <span
            style={{
              display: 'inline-block',
              height: '1em',
              width: '1em',
              backgroundColor: color,
              marginRight: '0.5em',
              fontSize: '20px'
            }}
          />
          {label}
        </div>
      ))}
    </div>
  );
};

export default SimpleLegend;
