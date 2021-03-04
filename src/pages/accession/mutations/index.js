import React, { useContext, useMemo, Suspense } from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

import Card from '../../../components/animated-card';
/*
import {
  CardContent,
} from '@material-ui/core';
*/
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';

import style from './style.module.css';

import { ProjectCtx, PdbCtx } from '../../../contexts';

import Loading from '../../../components/loading';

import { absolute2sourceResidue } from '../../../utils/topology-manager';

import useAPI from '../../../hooks/use-api';

import { BASE_PATH_TOPOREFS } from '../../../utils/constants';

import { ColormakerRegistry } from 'ngl';

import { color as d3color, interpolateRgb } from 'd3';

//import ResidueSelector from '../../../components/residue-selector';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const Mutations = () => {
  // Track if the NGL viewer
  // The status isNglVisible is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Set when one point in the graph is selected
  //const [selectedResidues, setSelectedResidues] = useState([]);

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

    const mutations = payload && payload.mutations;

    // Build a residues map from the topology reference
    let toporefMap;
    // DANI: Hardcodeado para trayectorias de Rebecca Wade
    if (metadata.PDBID === '6ACC') {
      toporefMap = residue => {
        // Primera cadena 1-1287
        if (residue >= 1 && residue <= 1287) return residue + 13;
        if (residue >= 1288 && residue <= 2572) return residue - 1274;
        if (residue >= 2573 && residue <= 3857) return residue - 2559;
        console.log('MEEECK!! ' + residue);
      };
    }

    // Get a list with all residues converted from source to model format
    /*
    const modelResidues = availableResidues.map(residue => {
      const numeration = complexNumerationParser(residue.name);
      const model = source2modelResidue(numeration, pdbData.file, metadata);
      return model;
    });
    */

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
        const sourceResidue = absolute2sourceResidue(
          residue,
          topology,
          metadata,
        ).residueNumber;
        const mapedResidue = toporefMap
          ? toporefMap(sourceResidue)
          : sourceResidue;
        const entropy = normalizedEntropies[mapedResidue];
        // Calculate the interpolated rgb for this value
        // The interpolated color comes in rbg format
        const hexColor = d3color(colorScale(entropy)).formatHex();
        // The color interpolation returns a string like '#000000'
        // We remove the first character ('#') and parse it to integer from hexadecimal
        const color = parseInt(hexColor.substring(1), 16);
        return color;
      };
    });

    const reps = [{ color: 'mutations' }];
    return [reps, colorScheme];
  }, [payload, topology, metadata]);

  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  return (
    <Suspense fallback={<Loading />}>
      {
        // DANI: Esto habría que implementarlo un día
        // DANI: No es tan facil como copiar el de rmsd-perres, porque aquel usa los residuos del payload
        /*<Card>
        <CardContent className={style.paper}>
          
          <ResidueSelector
            modelResidues={modelResidues}
            selectedResiduesSetter={setSelectedResidues}
          />
          
        </CardContent>
      </Card>*/
      }
      <Card className={style.nglcard} ref={nglRef}>
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <NGLViewerWithControls
            className={style.container}
            representations={representations}
            customColorSchemes={{ mutations: mutationsScheme }}
            //selectedResidues={selectedResidues}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </Suspense>
  );
};

export default Mutations;
