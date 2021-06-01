import React, {
  Suspense,
  useState,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { useInView } from 'react-intersection-observer';

import { Typography } from '@material-ui/core';

import { color as d3color, scaleLinear } from 'd3';

import Card from '../../../components/animated-card';
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx, ProjectCtx, PdbCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

import {
  complexNumerationParser,
  source2modelResidue,
  absolute2sourceResidue,
} from '../../../utils/topology-manager';

//import Selector from '../../../components/selector';

import { ColormakerRegistry } from 'ngl';

import ResidueSelector from '../../../components/residue-selector';

import Graph2 from '../../../components/graph2';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const Sasa = () => {
  // Track if the NGL viewer
  // The status isNglVisible is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);

  // Set a ref to the ngl which allows access to the ngl viewer exposed methods
  const viewerRef = useRef(null);

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/sasa/`,
  );

  // Set when one point in the graph is selected
  const [selectedFrame, setSelectedFrame] = useState(null);

  // Set when one point in the graph is selected
  const [selectedResidues, setSelectedResidues] = useState([]);

  // Get the residues list in model notation
  const {
    mainComponent,
    framesNumber,
    timeStep,
    sequences,
    whiteColorPlan,
  } = useMemo(() => {
    if (!pdbData.file || !metadata || !payload) return {};

    const data = payload.data;
    // Calculate the mean and standard deviation of each residue saspf
    // Also get the maximum and minimum means
    const means = data.map(residue => residue.mean);

    const max = Math.max(...means);
    const min = Math.min(...means);

    // Set the color scale according to the maximum and minimum means
    const greyColorPlan = ['grey', 'yellow', 'red'];
    const greyColorScale = scaleLinear()
      .range(greyColorPlan)
      .domain([min, (min + max) / 2, max]);

    // Set each residue color in the ngl representation according to the color cale
    // WARNING: Grey looks better than white because the background is white and the structure is easier to see
    const colorScheme = ColormakerRegistry.addScheme(function(params) {
      this.atomColor = atom => {
        // Find the residue index and then the entropy for this residue
        const residue = atom.residueIndex;
        const modelResiude = absolute2sourceResidue(
          residue,
          pdbData.file,
          metadata,
        ).numeration;
        //const entropy = normalizedEntropies[modelResiude];
        const mean = data.find(residue => residue.name === modelResiude).mean;
        // Calculate the interpolated rgb for this value
        // The interpolated color comes in rbg format
        const hexColor = d3color(greyColorScale(mean)).formatHex();
        // The color interpolation returns a string like '#000000'
        // We remove the first character ('#') and parse it to integer from hexadecimal
        const color = parseInt(hexColor.substring(1), 16);
        return color;
      };
    });

    const firstResidue = data[0];
    const framesNumber = firstResidue.saspf.length;

    // Guess the time step of the analysis from the number of frames
    const timeStep = metadata.LENGTH / (framesNumber - 1);

    // Guess the frames step of the analysis from the number of frames
    const frameStep = Math.floor(metadata.SNAPSHOTS / (framesNumber - 1));

    // Load the required frames from the main trajectory
    const mainURL = `${BASE_PATH_PROJECTS}${accession}/files/trajectory?frames=1:${metadata.SNAPSHOTS}:${frameStep}`;
    const mainComponent = [
      {
        trajectoryURLs: [mainURL],
        representations: [
          { color: 'custom', customScheme: colorScheme, type: 'spacefill' },
        ],
      },
    ];

    // Parse the selection string into a numeric array
    const availableResidues = data;

    // Get a list with all residues converted from source to model format
    const modelResidues = availableResidues.map(residue => {
      const numeration = complexNumerationParser(residue.name);
      const model = source2modelResidue(numeration, pdbData.file, metadata);
      return model;
    });

    // Separate the residues in chains and format them residues according to residue selector input format
    const chains = {};
    modelResidues.forEach((residue, index) => {
      const residueData = availableResidues[index];
      const fResidue = {
        letter: residue.letter,
        data: residueData,
        tooltip: `Mean: ${residueData.mean}\nStandard deviation: ${residueData.stdv}`,
        value: residueData.mean,
      };
      const chain = residue.chain;
      const current = chains[chain];
      if (current) chains[chain].push(fResidue);
      else chains[chain] = [fResidue];
    });
    const sequences = Object.entries(chains).map(([chain, residues]) => {
      return {
        name: 'Chain ' + chain,
        residues: residues,
      };
    });

    // Set the color of each residue letter in the residue selector
    // WARNING: White looks better than grey because the background is white and the contrast would be notable
    const whiteColorPlan = ['white', 'yellow', 'red'];

    return { mainComponent, framesNumber, timeStep, sequences, whiteColorPlan };
  }, [payload, pdbData, metadata, accession]);

  // Get the residues list in model notation
  const { selectedData, selectedResidueNames } = useMemo(() => {
    // Now get only the selected keys from the payload
    const selectedData = {};
    // Color the first selected residues in the graph
    selectedResidues.forEach((residue, i) => {
      const newData = { data: residue.saspf };
      newData.color = residue.color;
      selectedData[i] = newData;
    });
    const selectedResidueNames = selectedResidues.map(residue => residue.name);
    return { selectedData, selectedResidueNames };
  }, [selectedResidues]);

  // When the user clicks on the graph
  const handleFrameSelection = useCallback(frame => {
    viewerRef.current.togglePlaying(false);
    viewerRef.current.currentFrame = frame;
    //setSelectedFrame(frame);
  }, []);

  // When the ngl is playing
  const handleFrameProgress = useCallback(
    progress => {
      // Process is a float number which ranges from 0 to 1
      // Guess the frame number which belongs to the process
      // WARNING: The follwoing multiplication must return always a whole number
      // WARNING: This 'round' is only for the float problem (e.g. 57 = 56.9999...)
      //console.log('SASA frameCount: ' + framesNumber);
      const frame = Math.round(progress * (framesNumber - 1));
      setSelectedFrame(frame);
    },
    [framesNumber, setSelectedFrame],
  );

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!pdbData.file || !metadata) return <Loading />;

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card>
        <ResidueSelector
          sequences={sequences}
          selectedResiduesSetter={setSelectedResidues}
          colorPlan={whiteColorPlan}
          legendTitle={'Average SAS per atom (Å²)'}
        />
      </Card>
      <Card className={style['graph']}>
        {selectedResidues.length > 0 ? (
          <Graph2
            yData={selectedData}
            step={timeStep}
            xAxisLabel={'Time (ns)'}
            yAxisLabel={'SAS per atom (Å²)'}
            onSelect={handleFrameSelection}
            selected={selectedFrame}
          />
        ) : (
          <div className={style['graph-placeholder']}>
            <Typography variant="h6">No residue selected</Typography>
          </div>
        )}
      </Card>
      <Card className={style.nglcard} ref={nglRef}>
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <NGLViewerWithControls
            className={style.container}
            components={mainComponent}
            selectedResidues={selectedResidueNames}
            onProgress={handleFrameProgress}
            ref={viewerRef}
            framesSelect={false}
            highlightTypes={{
              atoms: 'spacefill',
              residues: 'spacefill',
              chains: 'spacefill',
              selections: 'spacefill',
            }}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </Suspense>
  );
};

export default Sasa;
