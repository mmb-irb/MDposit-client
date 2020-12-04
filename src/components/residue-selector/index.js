import React, { useMemo, useEffect } from 'react';

import style from './style.module.css';

const hoverColor = '#76FF03';

// The 'topology' input must be the ngl parsed topology (usually the pdbData.file)
// DANI: Cuando haya tiempo estaría bien implementar un argumento 'reference' que sería una toporef
// DANI: De esta manera podríamos mostrar residuos que faltan, gaps o mutaciones
const ResidueSelector = ({ modelResidues, selectedResiduesSetter }) => {
  // Separate the residues in chains
  const chains = useMemo(() => {
    // Numerate all residues, so the original array can be splitted
    modelResidues.forEach((residue, index) => {
      residue.index = index;
    });
    const newChains = {};
    for (const residue of modelResidues) {
      const chain = residue.chain;
      const current = newChains[chain];
      if (current) newChains[chain].push(residue);
      else newChains[chain] = [residue];
    }
    return newChains;
  }, [modelResidues]);

  useEffect(() => {
    const manager = document.getElementById('manager');

    // Highlight the residue when the mouse is over
    manager.addEventListener(
      'mouseover',
      event => {
        if (event.target.lang !== 'residue') return;
        event.target.style['background-color'] = hoverColor;
      },
      false,
    );
    // Unhighlight the residue when the mouse is out
    manager.addEventListener(
      'mouseout',
      event => {
        if (event.target.lang !== 'residue') return;
        event.target.style['background-color'] = '';
      },
      false,
    );

    // Set the selected residue when the mouse clicks
    manager.addEventListener(
      'mousedown',
      event => {
        if (event.target.lang !== 'residue') return;
        // WARNING: This method does not allow to get objects and there is no easy way to do it
        // Thats why this work around with the residue index is done
        const residueIndex = event.target.getAttribute('residueindex');
        const residue = modelResidues[residueIndex];
        let selected;
        if (selectedResiduesSetter)
          selectedResiduesSetter(previous => {
            const newState = [...previous];
            const index = newState.indexOf(residue);
            if (index === -1) {
              newState.push(residue);
              selected = true;
            } else {
              newState.splice(index, 1);
              selected = false;
            }
            return newState;
          });
        // Color the selected letter
        if (selected) {
          event.target.className = style['selected'];
        } else {
          event.target.className = style['normal'];
        }
      },
      false,
    );
    // Remove all added events in the clean up function
    return () => {
      manager.removeEventListener('mouseover');
      manager.removeEventListener('mouseout');
      manager.removeEventListener('mousedown');
    };
  }, [modelResidues, selectedResiduesSetter]);

  //console.log(chains);

  // Render
  return (
    <div id="manager">
      {Object.entries(chains).map(([chainName, residues]) => {
        return (
          <div key={chainName} className={style.flexible}>
            <span
              className={style['extra-right-margin']}
            >{`Chain ${chainName}:`}</span>
            {residues.map((residue, index) => {
              const isTen = (index + 1) % 10 === 0;
              return [
                <span
                  lang={'residue'}
                  key={index}
                  className={style['normal']}
                  //onMouseDown={() => console.log(residue)}
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
                      {residue.chainResidue}
                    </span>
                  </span>
                ),
              ];
            })}
          </div>
        );
      })}
    </div>
  );
};

export default ResidueSelector;
