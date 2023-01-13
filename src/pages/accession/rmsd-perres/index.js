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
import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

import { ColormakerRegistry } from 'ngl';

import ResidueSelector from '../../../components/residue-selector';

import Graph2 from '../../../components/graph2';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

// Set the color of each residue in the NGL representation
// WARNING: Grey looks better than white because the background may be white and resdiues are hard to see
const nglColorPlan = ['grey', 'yellow', 'red'];

// Round to cents
const nice = number => Math.round(number * 100) / 100;
// Get the average and standard deviation
const getStaistics = values => {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b) / n;
  const stdv = Math.sqrt(
    values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n,
  );
  return [nice(mean), nice(stdv)];
};

const RmsdPerres = () => {
  // Track if the NGL viewer
  // The status isNglVisible is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the current project data
  const { accession, metadata, topology: topologyManager } = useContext(
    ProjectCtx,
  );

  // Get the default representations
  const defaultRepresentations = useDefaultRepresentations();

  // Set a ref to the ngl which allows access to its exposed methods
  const viewerRef = useRef(null);
  // Set a ref to the graph which allows access to its exposed methods
  const graphRef = useRef(null);

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/rmsd-perres/`,
  );

  // Set when one point in the graph is selected
  const [selectedResidues, setSelectedResidues] = useState([]);

  // Get the residues list in model notation
  const {
    mainComponent,
    analysisFrameCount,
    xAxisStep,
    xAxisLabel,
    xUnit,
    data,
  } = useMemo(() => {
    if (!topologyManager || !metadata || !payload) return {};

    // Data is stored as RMSD per residue and per frame respectively
    const rmsdpr = payload.rmsdpr;
    // Calculate the mean and standard deviation of each residue rmsds
    // DANI: Esto he comprovado que cuesta 10 milisegundos aprox en una estructura grande
    const means = [];
    const stdvs = [];
    rmsdpr.forEach(rmsdpf => {
      if (rmsdpf === null) {
        means.push(null);
        stdvs.push(null);
      } else {
        const [mean, stdv] = getStaistics(rmsdpf);
        means.push(mean);
        stdvs.push(stdv);
      }
    });

    // Put all data together to be used further in this component
    const data = { rmsdpr, means, stdvs };

    // Also get the maximum and minimum means
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
        // Find the residue index and then the mean rmsd for this residue
        const residueIndex = atom.residueIndex;
        const mean = means[residueIndex];
        // If there is no data for this residue then paint it white
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
      representations.push(newRepresentation);
    });

    // Get the number of frames in the analysis from the first residue data
    const firstResidueData = rmsdpr[0];
    const analysisFrameCount = firstResidueData.length;

    // Get the number of frames in the trajectory
    const trajectoryFrameCount = metadata.SNAPSHOTS;

    // Get the frames step from the analysis itself
    const frameStep = payload['step'];

    // If this is an ensemble we use frames as the x axis
    // If this is a trajectory we use time as the x axis
    const xAxisStep =
      metadata.TYPE === 'ensemble'
        ? frameStep
        : metadata.LENGTH / (analysisFrameCount - 1);
    const xAxisLabel = metadata.TYPE === 'ensemble' ? 'Frames' : 'Time (ns)';
    const xUnit = metadata.TYPE === 'ensemble' ? 'frame' : 'ns';

    // Load the required frames from the main trajectory
    const mainURL = `${BASE_PATH_PROJECTS}${accession}/files/trajectory?frames=1:${trajectoryFrameCount}:${frameStep}`;
    const mainComponent = [
      {
        trajectoryURLs: [mainURL],
        representations: representations,
      },
    ];

    return {
      mainComponent,
      analysisFrameCount,
      xAxisStep,
      xAxisLabel,
      xUnit,
      data,
    };
  }, [payload, topologyManager, metadata, accession, defaultRepresentations]);

  // Get the residues list in model notation
  const { selectedData, selectedResidueIndices } = useMemo(() => {
    // Now get only the selected keys from the payload
    const selectedData = {};
    const selectedResidueIndices = [];
    // Color the first selected residues in the graph
    selectedResidues.forEach((residue, i) => {
      const currentResidueData = data.rmsdpr[residue.index];
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
      const frame = Math.round(progress * (analysisFrameCount - 1));
      graphRef.current.marks = [
        {
          x: frame,
          attr: { fill: '#c8c8c8' },
        },
      ];
    },
    [analysisFrameCount],
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
      const meanRMSD = Math.round(currentResidueMean * 100) / 100;
      const stdvRMSD = Math.round(currentResidueStdv * 100) / 100;
      return `Mean RMSD: ${meanRMSD}\nStandard deviation: ${stdvRMSD}`;
    },
    [data],
  );

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!topologyManager) return <Loading />;

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card>
        <ResidueSelector
          residueValues={data.means}
          legendTitle={'Average RMSD (Å)'}
          onSelect={handleSelect}
          onDeselect={handleDeselect}
          onClean={handleClean}
          onTooltip={handleTooltip}
        />
      </Card>
      <Card className={style.graphcard}>
        {selectedResidues.length > 0 ? (
          <Graph2
            yData={selectedData}
            step={xAxisStep}
            xAxisLabel={xAxisLabel}
            xUnit={xUnit}
            yAxisLabel={'RMSd (Å)'}
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
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </Suspense>
  );
};

export default RmsdPerres;
