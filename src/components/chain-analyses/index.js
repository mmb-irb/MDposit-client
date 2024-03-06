import React, { memo, useEffect } from 'react';

import Loading from '../loading';

import useAPI from '../../hooks/use-api';

import loadCustomElement from '../../utils/load-custom-element';

import { BASE_PATH_PROJECTS } from '../../utils/constants';

import processIPScanResults from './process-ipscan-results';
import InterproTrack from './react-interpro-track';

import style from './style.module.css';

const customElements = [];

const loadProtVista = () => {
  if (!customElements.length) {
    customElements.push(
      loadCustomElement(() =>
        import(/* webpackChunkName: "protvista-manager" */ 'protvista-manager'),
      ).as('protvista-manager'),
    );
    customElements.push(
      loadCustomElement(() =>
        import(
          /* webpackChunkName: "protvista-sequence" */ 'protvista-sequence'
        ),
      ).as('protvista-sequence'),
    );
    customElements.push(
      loadCustomElement(() =>
        import(
          /* webpackChunkName: "protvista-navigation" */ 'protvista-navigation'
        ),
      ).as('protvista-navigation'),
    );
    customElements.push(
      loadCustomElement(() =>
        import(
          /* webpackChunkName: "protvista-coloured-sequence" */ 'protvista-coloured-sequence'
        ),
      ).as('protvista-coloured-sequence'),
    );
  }
  return Promise.all(customElements);
};

// The result of this function is memoized since it is a heavy work
const ChainAnalyses = memo(({ accessionAndMdNumber, chain, firstResidueNumber }) => {
  // Request the API for the chain data
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/chains/${chain}`,
  );

  // Load the protvista managers
  useEffect(() => {
    loadProtVista();
  }, []);

  // Wait for the chain data to be retrieved
  if (loading) return <Loading />;
  if (error) return error.toString();
  if (!payload) return 'Chain analysis is not found';

  // Mine payload data
  const sequence = payload.sequence;
  const sequenceLength = sequence.length;
  const matches = payload.interproscan.results[0].matches;
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
