import React, { memo, useEffect } from 'react';

import Loading from '../loading';

import useAPI from '../../hooks/use-api';

import loadCustomElement from '../../utils/load-custom-element';
import processIPScanResults from '../../utils/process-ipscan-results';

import { BASE_PATH_PROJECTS } from '../../utils/constants';

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
const ChainAnalyses = memo(({ chain, accession }) => {
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}/${accession}/chains/${chain}`,
  );

  useEffect(() => {
    loadProtVista();
  }, []);

  if (loading) return <Loading />;
  if (error) return error.toString();
  if (!payload) return 'Chain analysis is not found';

  const {
    sequence,
    interproscan: {
      results: [{ matches }],
    },
  } = payload;
  const { length } = sequence;

  const processedMatches = processIPScanResults(matches);

  return (
    <protvista-manager
      attributes="length displaystart displayend highlight"
      data-chain-length={length}
      chain={chain}
    >
      <protvista-navigation
        length={length}
        displaystart={1}
        displayend={length}
      />
      <div className={style.entries}>
        <protvista-sequence
          sequence={sequence}
          length={length}
          displaystart={1}
          displayend={length}
          height="37"
        />
        <protvista-coloured-sequence
          sequence={sequence}
          length={length}
          scale="hydrophobicity-scale"
          height="15"
        />
        {processedMatches.length
          ? processedMatches.map((match, index) => {
            // DANI: Esto antes iba con el PropertySetter, un wrapper de Aurèlien
            // DANI: Este módulo no es compatible con react 18 así que hubo que quitarlo
            // DANI: No consigo que esto funcione sin el módulo y ya me he cansado
            // DANI: Se va a quedar así y el día que alguien se queje ya me lo volveré a mirar
            return (
              <div
                key={index} // I know...
              >
                <span className={style.label}>{match.accession}</span>
                <InterproTrack
                  match={match}
                  length={length}
                  displaystart={1}
                  displayend={length}
                  shape="roundRectangle"
                  classAttr={match.signatures ? style['has-signatures'] : undefined}
                />
              </div>
            )})
          : 'No entry was found for this sequence'}
      </div>
    </protvista-manager>
  );
});

export default ChainAnalyses;
