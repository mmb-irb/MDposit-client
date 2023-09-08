import React, {
  Suspense,
  useState,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { useInView } from 'react-intersection-observer';

import { Typography } from '@mui/material';

import { color as d3color, scaleLinear } from 'd3';

import Card from '../../../components/animated-card';
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';
import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

//import Selector from '../../../components/selector';

import { ColormakerRegistry } from 'ngl';

import ResidueSelector from '../../../components/residue-selector';

import Graph from '../../../components/graph';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

// Set the color of each residue in the NGL representation
// WARNING: Grey looks better than white because the background may be white and resdiues are hard to see
const nglColorPlan = ['grey', 'yellow', 'red'];

// Set the custom highlighted types
// In this analysis, since the default representation is spacefill, all highligths must be spacefill
// Otherwise they would be eclipsed by the base representation
const highlightTypes = {
  atoms: 'spacefill',
  residues: 'spacefill',
  chains: 'spacefill',
  selections: 'spacefill',
};

const Sasa = () => {
  // Track if the NGL viewer
  // The status isNglVisible is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the current project data
  const {
    accession,
    metadata,
    topology: topologyManager,
    populations,
  } = useContext(ProjectCtx);

  // Get the default representations
  const defaultRepresentations = useDefaultRepresentations();

  // Set a ref to the ngl which allows access to its exposed methods
  const viewerRef = useRef(null);
  // Set a ref to the graph which allows access to its exposed methods
  const graphRef = useRef(null);

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}/${accession}/analyses/sasa/`,
  );

  // Set when one point in the graph is selected
  const [selectedResidues, setSelectedResidues] = useState([]);

  // Get the residues list in model notation
  const {
    mainComponent,
    framesNumber,
    xAxisStep,
    xAxisLabel,
    isEnsemble,
    xTooltip,
    xWeights,
    data,
  } = useMemo(() => {
    if (
      !topologyManager ||
      !metadata ||
      !payload ||
      (populations && populations.loading)
    )
      return {};

    // Check data to be coherent
    // Note that sasa analysis must always have the same number of residues that the topology
    const residueCount = topologyManager.getResiduesCount();
    if (residueCount !== payload.saspf.length)
      throw new Error(
        'Number of residues in the analysis does not match number of residues in the topology',
      );

    // Duplicate the payload data but removing a few values
    // Data from single atom residues (i.e. ions) is discarded since they may raise the maximum SAS a lot
    // Note that sasa analysis will always have the same number of residues that the topology
    // Excluded residues (e.g. membrane residues) have null in all its values
    const data = { saspf: [], means: [], stdvs: [] };
    for (let r = 0; r < residueCount; r++) {
      const atomCount = topologyManager.getResidueAtomsCount(r);
      if (atomCount === 1) {
        data.saspf[r] = null;
        data.means[r] = null;
        data.stdvs[r] = null;
      } else {
        data.saspf[r] = payload.saspf[r];
        data.means[r] = payload.means[r];
        data.stdvs[r] = payload.stdvs[r];
      }
    }

    // Calculate the mean and standard deviation of each residue saspf
    // Also get the maximum and minimum means
    const means = data.means;
    const max = Math.max(...means);
    const min = Math.min(...means);

    // Set the color scale according to the maximum and minimum means
    const nglColorScale = scaleLinear()
      .range(nglColorPlan)
      .domain([min, (min + max) / 2, max]);

    // Set each residue color in the ngl representation according to the color cale
    // WARNING: Grey looks better than white because the background is white and the structure is easier to see
    const colorScheme = ColormakerRegistry.addScheme(function(params) {
      this.atomColor = atom => {
        // Find the residue index and then the entropy for this residue
        const residueIndex = atom.residueIndex;
        const residueAtomsCount = topologyManager.getResidueAtomsCount(
          residueIndex,
        );
        // Single atom residues (i.e. ions) are discarded since they may raise the maximum SAS a lot
        if (residueAtomsCount === 1) return 16777215;
        const mean = means[residueIndex];
        if (mean === null) return 16777215;
        // Calculate the interpolated rgb for this value
        // The interpolated color comes in rbg format
        const hexColor = d3color(nglColorScale(mean)).formatHex();
        // The color interpolation returns a string like '#000000'
        // We remove the first character ('#') and parse it to integer from hexadecimal
        const color = parseInt(hexColor.substring(1), 16);
        return color;
      };
    });

    // Set the representations by showing all default representations repainted
    const representations = [];
    defaultRepresentations.forEach(representation => {
      const newRepresentation = { ...representation };
      newRepresentation.color = 'custom';
      newRepresentation.customScheme = colorScheme;
      newRepresentation.type = 'spacefill';
      representations.push(newRepresentation);
    });

    // Get the number of frames in the analysis from the first residue data
    const firstResidueData = data.saspf[0];
    const framesNumber = firstResidueData.length;

    // Get the frames step from the analysis itself
    const frameStep = payload['step'];
    // Get the total time length
    const timeLength = metadata.LENGTH;
    // If this is an ensemble or we are missing the time length then we use frames as the x axis
    // If this is a trajectory and we have the time length then we use time as the x axis
    const isEnsemble = metadata.TYPE === 'ensemble';
    let xAxisStep;
    let xAxisLabel;
    let xTooltip;
    if (isEnsemble || !timeLength) {
      xAxisStep = frameStep;
      xAxisLabel = 'Frames';
      xTooltip = xValue => 'frame ' + xValue;
    }
    else {
      xAxisStep = timeLength / (framesNumber - 1);
      xAxisLabel = 'Time (ns)';
      xTooltip = xValue => +xValue.toFixed(2) + ' ns';
    }
    // Get the weigths for each data value corresponding frame
    let xWeights;
    if (populations && populations.payload) {
      xWeights = [];
      for (let i = 0; i < populations.payload.length; i += xAxisStep) {
        xWeights.push(populations.payload[i]);
      }
    }
    // Load the required frames from the main trajectory
    const mainURL = `${BASE_PATH_PROJECTS}/${accession}/files/trajectory?frames=1:${metadata.SNAPSHOTS}:${frameStep}`;
    const mainComponent = [
      {
        trajectoryURLs: [mainURL],
        representations: representations,
      },
    ];

    return {
      mainComponent,
      framesNumber,
      xAxisStep,
      xAxisLabel,
      isEnsemble,
      xTooltip,
      xWeights,
      data,
    };
  }, [
    payload,
    topologyManager,
    metadata,
    accession,
    defaultRepresentations,
    populations,
  ]);

  // Get the residues list in model notation
  const { selectedData, selectedResidueIndices } = useMemo(() => {
    // Now get only the selected residues
    const selectedData = {};
    const selectedResidueIndices = [];
    // Color the first selected residues in the graph
    selectedResidues.forEach((residue, i) => {
      const currentResidueData = data.saspf[residue.index];
      const newData = { data: currentResidueData };
      newData.color = residue.color;
      selectedData[i] = newData;
      selectedResidueIndices.push(residue.index);
    });
    return { selectedData, selectedResidueIndices };
  }, [data, selectedResidues]);

  // When the user clicks on the graph
  const handleFrameSelection = useCallback(frame => {
    viewerRef.current.togglePlaying(false);
    viewerRef.current.currentFrame = frame;
  }, []);

  // When the ngl is playing
  const handleFrameProgress = useCallback(
    progress => {
      if (!graphRef.current) return;
      // Process is a float number which ranges from 0 to 1
      // Guess the frame number which belongs to the process
      // WARNING: The follwoing multiplication must return always a whole number
      // WARNING: This 'round' is only for the float problem (e.g. 57 = 56.9999...)
      //console.log('SASA frameCount: ' + framesNumber);
      const frame = Math.round(progress * (framesNumber - 1));
      graphRef.current.marks = [
        {
          x: frame,
          attr: { fill: '#c8c8c8' },
        },
      ];
    },
    [framesNumber],
  );

  // When a residue is selected
  const handleSelect = useCallback(
    (residue, residueIndex, color) => {
      const selectedResidue = { color, index: residueIndex };
      setSelectedResidues(previous => [...previous, selectedResidue]);
    },
    [setSelectedResidues],
  );
  // When a residue is deselected
  const handleDeselect = useCallback(
    (residue, residueIndex) => {
      setSelectedResidues(previous =>
        previous.filter(residue => residue.index !== residueIndex),
      );
    },
    [setSelectedResidues],
  );
  // When the clean all residues button is clicked
  const handleClean = useCallback(() => {
    setSelectedResidues([]);
  }, [setSelectedResidues]);

  // Handle what to write on the tooltip when the user hovers a specific residue letter
  const handleTooltip = useCallback(
    (residue, residueIndex) => {
      const currentResidueMean = data.means[residueIndex];
      const currentResidueStdv = data.stdvs[residueIndex];
      const meanSAS = Math.round(currentResidueMean * 100) / 100;
      const stdvSAS = Math.round(currentResidueStdv * 100) / 100;
      return `Mean SAS: ${meanSAS}\nStandard deviation: ${stdvSAS}`;
    },
    [data],
  );

  // Render loading or error messages according with the API response
  if (loading || (populations && populations.loading)) return <Loading />;
  else if (error) return error.toString();
  else if (populations && populations.error)
    return populations.error.toString();
  else if (!payload) return 'Something bad happened';
  else if (populations && !populations.payload)
    return 'Something bad happened with populations';

  if (!topologyManager || !metadata) return <Loading />;

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card>
        <ResidueSelector
          residueValues={data.means}
          legendTitle={'Average Relative SAS (Å²)'}
          onSelect={handleSelect}
          onDeselect={handleDeselect}
          onClean={handleClean}
          onTooltip={handleTooltip}
        />
      </Card>
      <Card className={style.graphcard}>
        {selectedResidues.length > 0 ? (
          <Graph
            yData={selectedData}
            step={xAxisStep}
            xAxisLabel={xAxisLabel}
            yAxisLabel={'Relative SAS (Å²)'}
            type={isEnsemble ? 'dots' : 'line'}
            xWeights={xWeights}
            xTooltip={xTooltip}
            onSelect={handleFrameSelection}
            className={style.graph}
            ref={graphRef}
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
            selectedResidueIndices={selectedResidueIndices}
            onProgress={handleFrameProgress}
            ref={viewerRef}
            framesSelect={false}
            highlightTypes={highlightTypes}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </Suspense>
  );
};

export default Sasa;
