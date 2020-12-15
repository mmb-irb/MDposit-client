import React, { useMemo, useEffect } from 'react';

import style from './style.module.css';

// These colors are used to mark each selected residues
// When all colors are used the next residues are marked in black
const asignedColors = [
  { color: 'red' },
  { color: 'green' },
  { color: 'blue' },
  { color: 'orange' },
  { color: 'purple' },
];

// Check colors untils get an available color
// If no color is available then return black
const getColor = () => {
  for (const ac of asignedColors) {
    if (ac.used) continue;
    ac.used = true;
    return ac.color;
  }
  return 'black';
};
// Mark the color as not used, so it can be used further
const freeColor = color => {
  if (color === 'black') return;
  for (const ac of asignedColors) {
    if (ac.color === color) ac.used = false;
  }
};

// Add a triangle / arrow over the selected residue letter
// Return also the visual part, so its color can be changed
const addPointer = target => {
  const pivot = document.createElement('span');
  pivot.className = style.pivot;
  const pointer = document.createElement('span');
  pointer.className = style.pointer;
  pivot.appendChild(pointer);
  target.appendChild(pivot);
  return pointer;
};

// The 'topology' input must be the ngl parsed topology (usually the pdbData.file)
// Input format:
/*
sequences = [
  { 
    name: string,
    residues: [
      {
        letter: string,
        value: (whatever is to be 'set' on click)
        tooltip: string,
        color: string,
      },
      ...
    ],
  },
  ...
]
*/
// Render a flexible sequence of numerated residues which is also interactive
// WARNING: The color marks implementation requires de 'selectedResidues' state to be an array of objects
const ResidueSelector = ({ sequences, selectedResiduesSetter }) => {
  // Save an array with all 'settable' values
  const values = useMemo(() => {
    const values = [];
    let count = 0;
    sequences.forEach(sequence => {
      sequence.residues.forEach(residue => {
        residue.index = count;
        values.push(residue.value);
        count += 1;
      });
    });
    return values;
  }, [sequences]);

  // Add events to manage when the mouse hovers / outs / clicks on residues
  useEffect(() => {
    const manager = document.getElementById('manager');
    const handleMouseOver = event => {
      if (event.target.lang !== 'residue') return;
      addPointer(event.target);
    };
    const handleMouseOut = event => {
      if (event.target.lang !== 'residue') return;
      event.target.removeChild(event.target.lastChild);
    };
    const hadleMouseClick = event => {
      if (event.target.lang !== 'residue') return;
      // Remove the hover pointer so it does not interfere with the click pointer
      event.target.removeChild(event.target.lastChild);
      // WARNING: This method does not allow to get objects and there is no easy way to do it
      // Thats why it is done this work around with the residue index
      const residueIndex = event.target.getAttribute('residueindex');
      const value = values[residueIndex];
      let selected;
      let color;
      if (selectedResiduesSetter)
        selectedResiduesSetter(previous => {
          const newState = [...previous];
          const index = newState.indexOf(value);
          if (index === -1) {
            // Set an available color for this tag
            color = getColor();
            value.color = color;
            newState.push(value);
            selected = true;
          } else {
            newState.splice(index, 1);
            selected = false;
          }
          return newState;
        });
      // Add a pointer and color it
      if (selected) {
        const pointer = addPointer(event.target);
        pointer.style['border-top-color'] = color;
      }
      // Remove the pointer
      else {
        const pointer = event.target.lastChild;
        color = pointer.style['border-top-color'];
        freeColor(color);
        event.target.removeChild(pointer);
      }
      // Set the hover pointer back
      addPointer(event.target);
    };

    // Highlight the residue when the mouse is over
    manager.addEventListener('mouseover', handleMouseOver, true);
    // Unhighlight the residue when the mouse is out
    manager.addEventListener('mouseout', handleMouseOut, true);
    // Set the selected residue when the mouse clicks
    manager.addEventListener('mousedown', hadleMouseClick, true);
    // Remove all added events in the clean up function
    return () => {
      manager.removeEventListener('mouseover', handleMouseOver, true);
      manager.removeEventListener('mouseout', handleMouseOut, true);
      manager.removeEventListener('mousedown', hadleMouseClick, true);
    };
  }, [sequences, selectedResiduesSetter, values]);

  //console.log(chains);

  // Render
  return (
    <div id="manager">
      {sequences.map(sequence => {
        return (
          <details open key={sequence.name}>
            <summary>{sequence.name}</summary>
            <span className={style.flexible}>
              {sequence.residues.map((residue, index) => {
                // isTen is true once every 10 residues
                const isTen = (index + 1) % 10 === 0;
                return [
                  <span
                    lang={'residue'}
                    key={index}
                    className={style['normal']}
                    style={{ backgroundColor: residue.color }}
                    title={residue.tooltip}
                    residueindex={residue.index}
                  >
                    {residue.letter}
                  </span>,
                  isTen && (
                    <span
                      key={index + '_'}
                      className={style['extra-right-margin']}
                    >
                      <span className={style['small-up-number']}>
                        {index + 1}
                      </span>
                    </span>
                  ),
                ];
              })}
            </span>
          </details>
        );
      })}
    </div>
  );
};

export default ResidueSelector;
