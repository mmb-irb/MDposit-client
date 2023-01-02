import React, { Suspense, useContext } from 'react';

import Loading from '../loading';

import { ProjectCtx, PdbCtx } from '../../contexts';

// Set an easy legend with all chains and chainnames
// Results are collapsed according to unique chainnames
// DANI: This is not used right now and the code is obsolete (it should use the topology manager)
const ChainsLegend = () => {
  // Harvest chains in topology
  // WARNING: Do not use project.chains since only protein chains are included
  const chainTopology = useContext(PdbCtx).file.chainStore;
  const topologyChainnames = [];
  for (let c = 0; c < chainTopology.count; c++) {
    topologyChainnames.push(chainTopology.getChainname(c));
  }
  // Remove duplicates
  const chains = topologyChainnames.filter(
    (value, index, self) => self.indexOf(value) === index,
  );
  const chainnames = Object.values(useContext(ProjectCtx).metadata.CHAINNAMES);
  // Number of chains must match
  if (chains.length !== chainnames.length)
    throw new Error(
      `The numbers of chains in metadata (${chainnames.length}) and topology (${chainTopology.count}) does not match`,
    );
  // Collapse the results
  const uniqueChainnames = Array.from(new Set(chainnames));
  const collapsedChains = [];
  for (let u = 0; u < uniqueChainnames.length; u++) {
    const unique = uniqueChainnames[u];
    let collapsed;
    for (let c = 0; c < chainnames.length; c++) {
      const name = chainnames[c];
      if (unique === name) {
        if (collapsed) collapsed += ', ' + chains[c];
        else collapsed = chains[c];
      }
    }
    collapsedChains[u] = collapsed;
  }
  // Render
  return (
    <Suspense fallback={<Loading />}>
      {uniqueChainnames.map((name, index) => (
        <div key={name}>
          {name} - {collapsedChains[index]}
        </div>
      ))}
    </Suspense>
  );
};

export default ChainsLegend;
