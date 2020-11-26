import React, { useContext, useMemo } from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

import Card from '../../../components/animated-card';
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';

import style from './style.module.css';

import { ProjectCtx, PdbCtx } from '../../../contexts';

import Info from '../../../components/info';
import Loading from '../../../components/loading';

import { absolute2modelResidue } from '../../../utils/topology-manager';

import useAPI from '../../../hooks/use-api';

import { BASE_PATH_TOPOREFS } from '../../../utils/constants';

import { ColormakerRegistry } from 'ngl';

import { color as d3color, interpolateRgb } from 'd3';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const Mutations = () => {
  // useInView acts as a React hook
  // Track if the NGL viewer (nglRef) and the analyses (nightingaleRef) are on screen
  // The status (e.g. isNglVisible) is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the current project chains
  const { metadata } = useContext(ProjectCtx);
  // Get the current topology
  const pdbData = useContext(PdbCtx);
  const topology = pdbData.file;

  // Set the API url for the toporef data
  const toporefId = metadata && metadata.TOPOREF;
  const url = `${BASE_PATH_TOPOREFS}${toporefId}/`;

  const { loading, payload, error } = useAPI(url);

  // Set the representations for the NGL viewer
  const [representations, mutationsScheme] = useMemo(() => {
    if (!payload) return [];

    const mutations = payload.mutations;
    // We add a small extra value to avoid having 0s, which would return a negative infinity
    const logaritmicEntropy = mutations.map(entropy =>
      Math.log(entropy + 0.0001),
    );
    const entropies = logaritmicEntropy;
    const maxEntropy = Math.max(...entropies);
    const minEntropy = Math.min(...entropies);
    // Normalize entropies
    const normalizedEntropies = entropies.map(
      entropy => (entropy - minEntropy) * (1 / (maxEntropy - minEntropy)),
    );

    // Set the color scale, which ranges from 0 to 1
    const colorScale = value => {
      const lowerScale = interpolateRgb('grey', 'yellow');
      const higherScale = interpolateRgb('yellow', 'red');
      if (value < 0.5) return lowerScale(value * 2);
      else return higherScale((value - 0.5) * 2);
    };

    const colorScheme = ColormakerRegistry.addScheme(function(params) {
      this.atomColor = atom => {
        // Find the residue index and then the entropy for this residue
        const residue = atom.residueIndex;
        const modelResiude = absolute2modelResidue(residue, topology, metadata)
          .chainResidue;
        const entropy = normalizedEntropies[modelResiude];
        // Calculate the interpolated rgb for this value
        // The interpolated color comes in rbg format
        const hexColor = d3color(colorScale(entropy)).formatHex();
        // The color interpolation returns a string like '#000000'
        // We remove the first character ('#') and parse it to integer from hexadecimal
        const color = parseInt(hexColor.substring(1), 16);
        return color;
      };
    });

    const reps = [{ defaultColoringMethod: 'mutations' }];
    return [reps, colorScheme];
  }, [payload, topology, metadata]);

  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  //console.log(representations);

  return (
    <>
      <Card className={style.card} ref={nglRef}>
        <Info
          reference={'mutations'}
          tooltip={
            <>
              This is the mutations representation.
              <br />
              <br />
              The{' '}
              <a
                href="http://nglviewer.org/"
                target="_blank"
                rel="noreferrer noopener"
              >
                NGL viewer
              </a>{' '}
              represents the entropy of each residue.
            </>
          }
        />
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <NGLViewerWithControls
            className={style.container}
            representations={representations}
            customColorSchemes={{ mutations: mutationsScheme }}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </>
  );
};

export default Mutations;
