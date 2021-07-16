import React, { useMemo, useEffect } from 'react';

import style from './style.module.css';

import { CardContent } from '@material-ui/core';

import ColorLegend from '../color-legend';

import { scaleLinear } from 'd3';

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
        data: (whatever is to be 'set' on click)
        tooltip: string,
        value: string, (used to color the residue and set the legend numbers)
      },
      ...
    ],
  },
  ...
]
*/
// Render a flexible sequence of numerated residues which is also interactive
// WARNING: The color marks implementation requires de 'selectedResidues' state to be an array of objects
const ResidueSelector = ({
  sequences,
  colorPlan,
  selectedResiduesSetter,
  legendTitle,
}) => {
  // Save an array with all 'settable' values
  const { residuesData, maxValue, minValue } = useMemo(() => {
    // Collect all residues in all sequences
    const residues = [];
    let count = 0;
    sequences.forEach(sequence => {
      sequence.residues.forEach(residue => {
        residue.index = count;
        residues.push(residue);
        count += 1;
      });
    });
    // Get all residues data
    const residuesData = residues.map(residue => residue.data);
    const values = residues.map(residue => residue.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    // Set the color scale
    if (colorPlan) {
      // WARNING: It is recomended to use white as the majoritarian color for esthetic reasons
      const colorScale = scaleLinear()
        .range(colorPlan)
        .domain([minValue, (minValue + maxValue) / 2, maxValue]);
      // Set the color of each residue
      residues.forEach(residue => {
        residue.color = colorScale(residue.value);
      });
    }

    return { residuesData, maxValue, minValue };
  }, [sequences, colorPlan]);

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
      const data = residuesData[residueIndex];
      let selected;
      let color;
      if (selectedResiduesSetter)
        selectedResiduesSetter(previous => {
          const newState = [...previous];
          const index = newState.indexOf(data);
          if (index === -1) {
            // Set an available color for this
            color = getColor();
            data.color = color;
            newState.push(data);
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
        const pivot = event.target.lastChild;
        const pointer = pivot.lastChild;
        color = pointer.style['border-top-color'];
        freeColor(color);
        event.target.removeChild(pivot);
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
    // Remove all events and free all colors in the clean up function
    return () => {
      manager.removeEventListener('mouseover', handleMouseOver, true);
      manager.removeEventListener('mouseout', handleMouseOut, true);
      manager.removeEventListener('mousedown', hadleMouseClick, true);
      asignedColors.forEach(ac => (ac.used = false));
    };
  }, [sequences, selectedResiduesSetter, residuesData]);

  // Render
  return (
    <div className={style.horizontal}>
      {colorPlan && (
        <ColorLegend
          title={legendTitle}
          minValue={minValue}
          maxValue={maxValue}
          colorPlan={colorPlan}
          vertical={true}
        />
      )}
      <CardContent className={style.scroll} id="manager">
        {sequences.map(sequence => {
          return (
            <details open key={sequence.name}>
              <summary>{sequence.name}</summary>
              <span className={style.flexible}>
                {sequence.residues
                  .reduce((residueGroups, currentResidue, currentIndex) => {
                    const isTen = currentIndex % 10 === 0;
                    if (isTen) residueGroups.push([]);
                    const lastGroup = residueGroups[residueGroups.length - 1];
                    lastGroup.push(currentResidue);
                    return residueGroups;
                  }, [])
                  .map((residueGroup, groupIndex) => {
                    const letters = residueGroup.map((residue, index) => {
                      return (
                        <span
                          lang={'residue'}
                          key={index}
                          className={style['normal']}
                          style={{ backgroundColor: residue.color }}
                          title={residue.tooltip}
                          residueindex={residue.index}
                        >
                          {residue.letter}
                        </span>
                      );
                    });
                    return (
                      <span key={groupIndex} className={style['margined']}>
                        {letters}
                        <span className={style['extra-right-margin']}>
                          <span className={style['small-up-number']}>
                            {(groupIndex + 1) * 10}
                          </span>
                        </span>
                      </span>
                    );
                  })}
              </span>
            </details>
          );
        })}
      </CardContent>
    </div>
  );
};

export default ResidueSelector;
