import React, { memo, useEffect, useRef } from 'react';

import loadCustomElement from '../../../../../utils/load-custom-element';

import processIPScanResults from './process-ipscan-results';

import style from './style.module.css';

// Keep elements out of any component, since they must be imported just once
let customElements = [];
// This promise is further resolven when all protvista elements have finished the import process
let protvistaLoadedResolve;
const protvistaLoaded = new Promise(resolve => { protvistaLoadedResolve = resolve });

// Load all protvista components together in a 'custom' way for them to work
const importProtVista = async () => {
  if (customElements.length > 0) return;
  customElements = [
        // WARNING: We must make sure the manager is imported before the others
        // Otherwise we get many errors of 'this.manager.register is not a function'
        // The rest of components may be imported in any order
        await loadCustomElement(() => import(
            /* webpackChunkName: "protvista-manager" */ 'protvista-manager'),
        ).as('protvista-manager'),
        loadCustomElement(() => import(
            /* webpackChunkName: "protvista-sequence" */ 'protvista-sequence'
        )).as('protvista-sequence'),
        loadCustomElement(() => import(
            /* webpackChunkName: "protvista-navigation" */ 'protvista-navigation'
        )).as('protvista-navigation'),
        loadCustomElement(() => import(
            /* webpackChunkName: "protvista-coloured-sequence" */ 'protvista-coloured-sequence'
        )).as('protvista-coloured-sequence'),
        loadCustomElement(() => import(
            /* webpackChunkName: "protvista-coloured-sequence" */ 'protvista-coloured-sequence'
        )).as('protvista-coloured-sequence'),
        loadCustomElement(() => import(
            /* webpackChunkName: "protvista-interpro-track" */ 'protvista-interpro-track'
        )).as('protvista-interpro-track')
  ];
  // Wait until all protvista elements are loaded and then resolve the promise
  await Promise.all(customElements);
  protvistaLoadedResolve();
};

// Set the protvista interpro track independently, since it needs to keep its own reference
const InterproTrack = memo(({ match, length, shape, classAttr }) => {
    // Set a reference to the protvista element
    const protvistaRef = useRef();
    // Update protvista element data after render
    useEffect(() => {
        const fillComponentWithData = async () => {
            // Make sure the element has been imported already or it wont work
            await protvistaLoaded;
            // Load data in the reference
            protvistaRef.current.data = [match];
            protvistaRef.current.contributors = match.signatures || [];
        }
        fillComponentWithData();
    }, []);
    // Render the element
    return (
        <protvista-interpro-track
            ref={protvistaRef}
            length={length}
            shape={shape}
            class={classAttr}
        />
    );
});

// The result of this function is memoized since it is a heavy work
const ChainAnalyses = memo(({ chain, data, firstResidueNumber }) => {
    // Import protvista elements in their 'custom' way
    useEffect(() => {
        importProtVista();
    }, []);
    // Mine data
    const sequence = data.sequence;
    const sequenceLength = sequence.length;
    const interproscanData = data.interproscan;
    // It may happen that interproscan data is missing when we have a small sequence
    if (!interproscanData) return 'No InterProScan data';
    const matches = interproscanData.results[0].matches;
    const processedMatches = processIPScanResults(matches, firstResidueNumber);
    // Set the end residue to be displayed
    const displayEnd = firstResidueNumber + sequenceLength;
    // Set an shifted sequence by adding null values at the begining
    // This is the only way I figured out to offset the sequence
    // Apparently protvista sequence components have no argument for this
    const shiftedSequence = ' '.repeat(firstResidueNumber) + sequence;
    return (
        <protvista-manager
            attributes="length displaystart displayend"
            length={sequenceLength}
            chain={chain}
        >
        <protvista-navigation
            rulerstart={firstResidueNumber}
            displaystart={firstResidueNumber}
            displayend={displayEnd}
        />
        <div className={style.entries}>
            <protvista-sequence
                sequence={shiftedSequence}
                height="37"
            />
            <protvista-coloured-sequence
                sequence={shiftedSequence}
                scale="hydrophobicity-scale"
                height="15"
            />
            { processedMatches.length
            ? processedMatches.map((match, index) => {
                return (
                <div key={index} >
                    <span className={style.label}>{match.accession}</span>
                    <InterproTrack
                    match={match}
                    shape="roundRectangle"
                    classAttr={match.signatures ? style['has-signatures'] : undefined}
                    />
                </div>
                )})
            : 'No entry was found for this sequence'
            }
        </div>
        </protvista-manager>
    );
});

export default ChainAnalyses;
