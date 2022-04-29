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

import { AccessionCtx, ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

import { complexNumerationParser } from '../../../utils/topology-manager';

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

  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project data
  const { metadata, topology: topologyManager } = useContext(ProjectCtx);

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
    timeStep,
    residueData,
    residueMeans,
  } = useMemo(() => {
    if (!topologyManager || !metadata || !payload) return {};

    // Reformat data, find each residue source notation and absolute index
    const data = payload.data.map(residue => {
      const sourceResidue = complexNumerationParser(residue.name);
      const absoluteResidue = topologyManager.source2absoluteResidue(
        sourceResidue,
      );
      // Calculate the mean and standard deviation of each residue rmsds
      const [mean, stdv] = getStaistics(residue.rmsds);
      return {
        ...residue,
        ...sourceResidue,
        index: absoluteResidue,
        mean,
        stdv,
      };
    });
    // Calculate the mean and standard deviation of each residue rmsds
    data.forEach(residue => {
      const [mean, stdv] = getStaistics(residue.rmsds);
      residue.mean = mean;
      residue.stdv = stdv;
    });

    // Also get the maximum and minimum means
    const means = data.map(residue => residue.mean);
    const max = Math.max(...means);
    const min = Math.min(...means);

    // Set a list with the data of each residue for every residue in the topology
    // Residues not included in the analysis data will remain as null
    const residuesCount = topologyManager.getResiduesCount();
    const residueData = new Array(residuesCount).fill(null);
    data.forEach(residue => {
      residueData[residue.index] = residue;
    });
    // Get the mean for each residue in topology
    const residueMeans = residueData.map(
      residue => (residue && residue.mean) || null,
    );

    // Set the color scale according to the maximum and minimum means
    const nglColorScale = scaleLinear()
      .range(nglColorPlan)
      .domain([min, (min + max) / 2, max]);

    // Set each residue color in the ngl representation according to the color cale
    // WARNING: Grey looks better than white because the background is white and the structure is easier to see
    const colorScheme = ColormakerRegistry.addScheme(function(params) {
      this.atomColor = atom => {
        // Find the residue index and then the entropy for this residue
        const residue = atom.residueIndex;
        const currentResidueData = residueData[residue];
        // If there is no data for the current residue then paint it white
        if (!currentResidueData) return 16777215;
        const mean = currentResidueData.mean;
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

    const firstResidue = data[0];
    const analysisFrameCount = firstResidue.rmsds.length;
    const trajectoryFrameCount = metadata.SNAPSHOTS;

    // Guess the time step of the analysis from the number of frames
    const timeStep = metadata.LENGTH / (analysisFrameCount - 1);

    // Guess the frames step of the analysis from the number of frames
    const frameStep = Math.floor(
      trajectoryFrameCount / (analysisFrameCount - 1),
    );

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
      timeStep,
      residueData,
      residueMeans,
    };
  }, [payload, topologyManager, metadata, accession, defaultRepresentations]);

  // Get the residues list in model notation
  const { selectedData, selectedResidueNames } = useMemo(() => {
    // Now get only the selected keys from the payload
    const selectedData = {};
    const selectedResidueNames = [];
    // Color the first selected residues in the graph
    selectedResidues.forEach((residue, i) => {
      const currentResidueData = residueData[residue.index];
      const newData = { data: currentResidueData.rmsds };
      newData.color = residue.color;
      selectedData[i] = newData;
      selectedResidueNames.push(currentResidueData.name);
    });
    return { selectedData, selectedResidueNames };
  }, [residueData, selectedResidues]);

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
      const currentResidueData = residueData[residueIndex];
      const meanRMSD = Math.round(currentResidueData.mean * 100) / 100;
      const stdvRMSD = Math.round(currentResidueData.stdv * 100) / 100;
      return `Mean RMSD: ${meanRMSD}\nStandard deviation: ${stdvRMSD}`;
    },
    [residueData],
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
          residueValues={residueMeans}
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
            step={timeStep}
            xAxisLabel={'Time (ns)'}
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
            selectedResidues={selectedResidueNames}
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
