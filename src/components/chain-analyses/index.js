import React, { memo, useEffect } from 'react';
import PropertySetter from 'react-property-setter';

import Loading from '../loading';

import useAPI from '../../hooks/use-api';

import loadCustomElement from '../../utils/load-custom-element';
import processIPScanResults from '../../utils/process-ipscan-results';

import { BASE_PATH_PROJECTS } from '../../utils/constants';

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
          /* webpackChunkName: "protvista-interpro-track" */ 'protvista-interpro-track'
        ),
      ).as('protvista-interpro-track'),
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
    `${BASE_PATH_PROJECTS}${accession}/chains/${chain}`,
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
        <PropertySetter property="data" value={sequence}>
          <protvista-sequence
            length={length}
            displaystart={1}
            displayend={length}
            height="37"
          />
        </PropertySetter>
        <PropertySetter property="data" value={sequence}>
          <protvista-coloured-sequence
            length={length}
            scale="hydrophobicity-scale"
            height="15"
          />
        </PropertySetter>
        {processedMatches.length
          ? processedMatches.map((match, index) => (
              <div
                key={index} // I know...
              >
                <span className={style.label}>{match.accession}</span>
                <PropertySetter
                  property="contributors"
                  value={match.signatures || []}
                >
                  <PropertySetter property="data" value={[match]}>
                    <protvista-interpro-track
                      length={length}
                      displaystart={1}
                      displayend={length}
                      shape="roundRectangle"
                      class={
                        match.signatures ? style['has-signatures'] : undefined
                      }
                    />
                  </PropertySetter>
                </PropertySetter>
              </div>
            ))
          : 'No entry was found for this sequence'}
      </div>
    </protvista-manager>
  );
});

export default ChainAnalyses;
