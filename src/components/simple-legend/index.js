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
        <div key={i}>
          <span
            style={{
              display: 'inline-block',
              height: '1em',
              width: '1em',
              backgroundColor: color,
              marginRight: '0.5em',
            }}
          />
          {label}
        </div>
      ))}
    </div>
  );
};

export default SimpleLegend;
