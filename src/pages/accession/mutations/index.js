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

import { AccessionCtx, ProjectCtx, PdbCtx } from '../../../contexts';

import Loading from '../../../components/loading';

import { absolute2sourceResidue } from '../../../utils/topology-manager';

import useAPI from '../../../hooks/use-api';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

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

  // Get the current project accession and metadata
  const accession = useContext(AccessionCtx);
  const { metadata } = useContext(ProjectCtx);
  // Get the current topology
  const pdbData = useContext(PdbCtx);
  const topology = pdbData.file;

  // Request to API the toporef data
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/toporefs`,
  );

  // Set the representations for the NGL viewer
  const [representations, entropiesColorScheme] = useMemo(() => {
    if (!payload) return [];

    const firstAndUniqueToporef = payload && payload[0];
    const entropies = firstAndUniqueToporef.entropies;

    // Build a residues map from the topology reference
    let toporefMap;
    const toporefs = metadata.TOPOREFS;
    if (toporefs && toporefs.length > 0) {
      toporefMap = residue => {
        for (const toporef of toporefs) {
          const equivalent = toporef.map[residue];
          if (equivalent) return equivalent;
        }
        return null;
      };
    }

    // DANI: Hardcodeado para trayectorias de Rebecca Wade
    if (!toporefMap && metadata.PDBID === '6ACC') {
      toporefMap = residue => {
        // Primera cadena 1-1287
        if (residue >= 1 && residue <= 1287) return residue + 13;
        if (residue >= 1288 && residue <= 2572) return residue - 1274;
        if (residue >= 2573 && residue <= 3857) return residue - 2559;
        console.log('MEEECK!! ' + residue);
      };
    }

    // We add a small extra value to avoid having 0s, which would return a negative infinity
    const logaritmicEntropies = entropies.map(entropy =>
      Math.log(entropy + 0.0001),
    );
    const maxEntropy = Math.max(...logaritmicEntropies);
    const minEntropy = Math.min(...logaritmicEntropies);
    // Normalize entropies
    const normalizedEntropies = logaritmicEntropies.map(
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
        // WARNING: atom.residueIndex starts the count at 0 although it may seem that starts at 1
        // WARNING: It may happen that the first residue is a capping terminal and it is skipped
        // WARNING: The cartoon representation would skip the non-standard residue and start by 1
        const residue = atom.residueIndex;
        const mapedResidue = toporefMap
          ? toporefMap(residue)
          : absolute2sourceResidue(residue, topology).residueNumber - 1; // -1 because the residue 'x' would be the index 'x-1' in the array
        //console.log(residue + ' -> ' + mapedResidue);
        // If no residue was found then paint it white
        if (mapedResidue === null) return parseInt('ffffff', 16);
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

    const reps = [{ color: 'entropies' }];
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
            customColorSchemes={{ entropies: entropiesColorScheme }}
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
