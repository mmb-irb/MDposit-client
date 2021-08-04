import React, { useMemo, useEffect, useRef, useState } from 'react';

import style from './style.module.css';

import { CardContent, IconButton } from '@material-ui/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

import ColorLegend from '../color-legend';

import useColors from '../../hooks/use-colors';

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

// Set the color of each residue letter in the residue selector by default
// WARNING: White looks better as minimum color because the background is white so the contrast is low
const defaultColorPlan = ['white', 'yellow', 'red'];

// Render a flexible sequence of numerated residues which is also interactive
const ResidueSelector = ({
  // Main input format:
  // sequences = [
  //   {
  //     name: string,
  //     residues: [
  //       {
  //         letter: string,
  //         tooltip: string,
  //         value: float, (used to color the residue and set the legend numbers)
  //         ... (add as many extra fields as desired; they will be returned on selection)
  //       },
  //       ...
  //     ],
  //   },
  //   ...
  // ]
  sequences,
  // Set how residues must be colored according to their 'value'
  colorPlan = defaultColorPlan,
  // Set the title for the color legend
  legendTitle,
  // Use these callbacks to receive the selected/deselected residues and all its data
  // WARNING: They must be memoized or strange things may happen
  onSelect,
  onDeselect,
  onClean,
  // Pass a whole useState to make it handle the selected residues
  // This only makes sense if you want to control the residues selection from outside this tool in addition
  forcedResiduesSelection,
}) => {
  // Use the colors hook
  const [getColor, freeColor, freeAllColors] = useColors();
  // Save an array with all 'settable' values
  const { residues, maxValue, minValue } = useMemo(() => {
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
    // Get all residues values to find out the minimum and maximum values
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

    return { residues, maxValue, minValue };
  }, [sequences, colorPlan]);

  // Save all current pointers
  const pointersRef = useRef([]);

  // Track when one point in the graph is selected (internal default state)
  const internalResiduesSelection = useState([]);
  // Track when one point in the graph is selected
  // WARNING: The color marks implementation requires the 'selectedResidues' state to be an array of objects
  const [selectedResidues, setSelectedResidues] = forcedResiduesSelection
    ? forcedResiduesSelection
    : internalResiduesSelection;

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
      const residueElement = event.target;
      if (residueElement.lang !== 'residue') return;
      // Remove the hover pointer so it does not interfere with the click pointer
      residueElement.removeChild(residueElement.lastChild);
      // WARNING: This method does not allow to get objects and there is no easy way to do it
      // Thats why it is done this work around with the residue index
      const residueIndex = residueElement.getAttribute('residueindex');
      const residue = residues[residueIndex];
      // Get the residue tagcolor if it has one. Otherwise get an available tagcolor for it
      let index;
      let selected;
      let tagcolor = residue.tagcolor ? residue.tagcolor : getColor();
      setSelectedResidues(previous => {
        const newState = [...previous];
        index = newState.indexOf(residue);
        selected = index === -1;
        // When it is selected
        if (selected) {
          residue.tagcolor = tagcolor;
          newState.push(residue);
          // Call the 'onSelect' function passing the current selected residue object
          if (onSelect) onSelect(residue);
        }
        // When it is deselected
        else {
          residue.tagcolor = null;
          newState.splice(index, 1);
          // Call the 'onDeselect' function passing the current deselected residue object
          if (onDeselect) onDeselect(residue);
        }
        return newState;
      });
      // Add a pointer and color it
      if (selected) {
        const pointer = addPointer(residueElement);
        pointer.style['border-top-color'] = tagcolor;
        pointersRef.current.push(pointer);
      }
      // Remove the pointer
      else {
        const pivot = residueElement.lastChild;
        //const pointer = pivot.lastChild;
        //tagcolor = pointer.style['border-top-color'];
        freeColor(tagcolor);
        residueElement.removeChild(pivot);
        // WARNING: Do not run this command inside 'setSelectedResidues' since it may be run twice
        // This is not a problem however for the state itself
        // The double run is a React conspiration to force you to keep updaters as pure functions
        pointersRef.current.splice(index, 1);
      }
      // Set the hover pointer back
      addPointer(residueElement);
    };

    // Highlight the residue when the mouse is over
    manager.addEventListener('mouseover', handleMouseOver, true);
    // Unhighlight the residue when the mouse is out
    manager.addEventListener('mouseout', handleMouseOut, true);
    // Set the selected residue when the mouse clicks
    manager.addEventListener('mousedown', hadleMouseClick, true);
    // Remove all events and free all tagcolors in the clean up function
    return () => {
      manager.removeEventListener('mouseover', handleMouseOver, true);
      manager.removeEventListener('mouseout', handleMouseOut, true);
      manager.removeEventListener('mousedown', hadleMouseClick, true);
      freeAllColors();
    };
  }, [
    sequences,
    setSelectedResidues,
    residues,
    onSelect,
    onDeselect,
    getColor,
    freeColor,
    freeAllColors,
  ]);

  // Set a function to remove all selected residues
  const cleanSelections = () => {
    for (const pointer of pointersRef.current) {
      const pivot = pointer.parentElement;
      const target = pivot.parentElement;
      target.removeChild(pivot);
    }
    pointersRef.current = [];
    freeAllColors();
    selectedResidues.forEach(residue => {
      residue.tagcolor = null;
    });
    setSelectedResidues([]);
    if (onClean) onClean();
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
