import React, { useContext, useMemo, useEffect, useRef, useState } from 'react';

import style from './style.module.css';

import { CardContent, IconButton } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

import ColorLegend from '../color-legend';

import useColors from '../../hooks/use-colors';

import { scaleLinear } from 'd3';

import { ProjectCtx } from '../../contexts';

// Set the number of residues between each numeration flag
const residuesPerGroup = 10;

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
  // A list of values to color residues
  // The list must have the same length that the total residues list
  // Null values will hide residues in the selector
  residueValues,
  // Set how residues must be colored according to their 'value'
  colorPlan = defaultColorPlan,
  // Set the title for the color legend
  legendTitle,
  // Use these callbacks to receive the selected/deselected residues and all its data
  // WARNING: They must be memoized or strange things may happen
  onSelect,
  onDeselect,
  onClean,
  onTooltip,
  // Pass a whole useState to make it handle the selected residues
  // This only makes sense if you want to control the residues selection from outside this tool in addition
  forcedResiduesSelection,
  // To force a styling
  className,
}) => {
  // Get the current project data
  const { topology: topologyManager } = useContext(ProjectCtx);

  // Get the residues list in model notation
  const { sequences, residueData, maxValue, minValue } = useMemo(() => {
    if (!topologyManager) return {};
    const residuesCount = topologyManager.getResiduesCount();
    // Get all topology residues and separate them by chains
    const chains = {};
    // Get also all residues together and fill missing residues with nulls
    const residueData = new Array(residuesCount).fill(null);
    for (let residueIndex = 0; residueIndex < residuesCount; residueIndex++) {
      const value = residueValues[residueIndex];
      if (value === null) continue;
      const source = topologyManager.absolute2sourceResidue(residueIndex);
      const ref = topologyManager.absolute2reference(residueIndex);
      const formattedResidue = {
        index: residueIndex,
        letter: source.letter,
        number: (ref && ref.index) || source.residueNumber,
        value: value,
      };
      residueData[residueIndex] = formattedResidue;
      const chain = source.chain;
      const current = chains[chain];
      if (current) current.push(formattedResidue);
      else chains[chain] = [formattedResidue];
    }
    const sequences = Object.entries(chains).map(([chain, residues]) => {
      return {
        name: 'Chain ' + chain,
        residues: residues,
      };
    });
    // Get the minimum and maximum residue values
    const maxValue = Math.max(...residueValues);
    const minValue = Math.min(...residueValues);
    // Set the color scale
    if (colorPlan) {
      // WARNING: It is recomended to use white as the majoritarian color for esthetic reasons
      const colorScale = scaleLinear()
        .range(colorPlan)
        .domain([minValue, (minValue + maxValue) / 2, maxValue]);
      // Set the color of each residue
      residueData.forEach(residue => {
        if (!residue) return;
        residue.color = colorScale(residue.value);
      });
    }

    return { sequences, residueData, maxValue, minValue };
  }, [residueValues, colorPlan, topologyManager]);

  // Use the colors hook
  const [getColor, freeColor, freeAllColors] = useColors();

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
      const residue = residueData[residueIndex];
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
        }
        // When it is deselected
        else {
          residue.tagcolor = null;
          newState.splice(index, 1);
        }
        return newState;
      });
      // Add a pointer and color it
      if (selected) {
        // Call the 'onSelect' function passing the current selected residue object
        if (onSelect) onSelect(residue, residueIndex, tagcolor);
        const pointer = addPointer(residueElement);
        pointer.style['border-top-color'] = tagcolor;
        pointersRef.current.push(pointer);
      }
      // Remove the pointer
      else {
        // Call the 'onDeselect' function passing the current deselected residue object
        if (onDeselect) onDeselect(residue, residueIndex, tagcolor);
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
    residueData,
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
    <div className={className || style.default}>
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
                      const groupEnd = currentIndex % residuesPerGroup === 0;
                      if (groupEnd) residueGroups.push([]);
                      const lastGroup = residueGroups[residueGroups.length - 1];
                      lastGroup.push(currentResidue);
                      return residueGroups;
                    }, [])
                    .map((residueGroup, groupIndex) => {
                      const lastResidueNumber =
                        residueGroup[residueGroup.length - 1].number;
                      const groupNumber =
                        lastResidueNumber ||
                        (groupIndex + 1) * residuesPerGroup;
                      const letters = residueGroup.map((residue, index) => {
                        return (
                          <span
                            lang={'residue'}
                            key={index}
                            className={style['normal']}
                            title={
                              onTooltip && onTooltip(residue, residue.index)
                            }
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
                          {letters.length === residuesPerGroup && (
                            <span className={style['extra-right-margin']}>
                              <span className={style['small-up-number']}>
                                {groupNumber}
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
            size="large"
          >
            <FontAwesomeIcon icon={faTrash} />
          </IconButton>
        )}
      </div>
    </div>
  );
};

export default ResidueSelector;
