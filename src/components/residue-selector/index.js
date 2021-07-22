import React, { useMemo, useEffect, useRef } from 'react';

import style from './style.module.css';

import { CardContent, IconButton } from '@material-ui/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

import ColorLegend from '../color-legend';

import { getColor, freeColor, freeAllColors } from '../../utils/color-admin';

import { scaleLinear } from 'd3';

// Add a triangle / arrow over the selected residue letter
// Return also the visual part, so its color can be changed
const addPointer = target => {
  const pivot = document.createElement('span');
  pivot.className = style.pivot;
  const pointer = document.createElement('span');
  pointer.className = style.pointer;
  pointer.lang = 'pointer';
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
  selectedResidues,
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

  // Save all current pointers
  const pointersRef = useRef([]);

  // Add events to manage when the mouse hovers / outs / clicks on residues
  useEffect(() => {
    const manager = document.getElementById('manager');
    const handleMouseOver = event => {
      const residue = event.target;
      if (residue.lang !== 'residue') return;
      addPointer(residue);
    };
    const handleMouseOut = event => {
      const residue = event.target;
      if (residue.lang !== 'residue') return;
      residue.removeChild(residue.lastChild);
    };
    const hadleMouseClick = event => {
      const residue = event.target;
      if (residue.lang !== 'residue') return;
      // Remove the hover pointer so it does not interfere with the click pointer
      residue.removeChild(residue.lastChild);
      // WARNING: This method does not allow to get objects and there is no easy way to do it
      // Thats why it is done this work around with the residue index
      const residueIndex = residue.getAttribute('residueindex');
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
            data.color = null;
            newState.splice(index, 1);
            pointersRef.current.splice(index, 1);
            selected = false;
          }
          return newState;
        });
      // Add a pointer and color it
      if (selected) {
        const pointer = addPointer(residue);
        pointer.style['border-top-color'] = color;
        pointersRef.current.push(pointer);
      }
      // Remove the pointer
      else {
        const pivot = residue.lastChild;
        const pointer = pivot.lastChild;
        color = pointer.style['border-top-color'];
        freeColor(color);
        residue.removeChild(pivot);
      }
      // Set the hover pointer back
      addPointer(residue);
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
      freeAllColors();
    };
  }, [sequences, selectedResiduesSetter, residuesData]);

  // Set a function to remove all selected residues
  const cleanSelections = () => {
    for (const pointer of pointersRef.current) {
      const pivot = pointer.parentElement;
      const target = pivot.parentElement;
      target.removeChild(pivot);
    }
    pointersRef.current = [];
    freeAllColors();
    selectedResiduesSetter([]);
  };

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
          className={style.thin}
        />
      )}
      <CardContent className={style.scroll} id="manager">
        {sequences.map(sequence => {
          return (
            <details open key={sequence.name}>
              <summary style={{ cursor: 'pointer' }}>{sequence.name}</summary>
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
                          title={residue.tooltip}
                          residueindex={residue.index}
                        >
                          <span
                            className={style['letter']}
                            style={{ backgroundColor: residue.color }}
                          >
                            {residue.letter}
                          </span>
                        </span>
                      );
                    });
                    return (
                      <span key={groupIndex} className={style['margined']}>
                        {letters}
                        {letters.length === 10 && (
                          <span className={style['extra-right-margin']}>
                            <span className={style['small-up-number']}>
                              {(groupIndex + 1) * 10}
                            </span>
                          </span>
                        )}
                      </span>
                    );
                  })}
              </span>
            </details>
          );
        })}
      </CardContent>
      {selectedResidues.length > 0 && (
        <IconButton
          title="Clean selections"
          onClick={cleanSelections}
          className={style.button}
        >
          <FontAwesomeIcon icon={faTrash} />
        </IconButton>
      )}
    </div>
  );
};

export default ResidueSelector;
