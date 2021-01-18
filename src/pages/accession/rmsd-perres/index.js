import React, { lazy, Suspense, useState, useContext, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';

import { CardContent } from '@material-ui/core';

import { interpolateRgb } from 'd3';

import Card from '../../../components/animated-card';
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';
import Info from '../../../components/info';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx, ProjectCtx, PdbCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

import {
  complexNumerationParser,
  source2modelResidue,
} from '../../../utils/topology-manager';

//import Selector from '../../../components/selector';

import ResidueSelector from '../../../components/residue-selector';

const Graph2 = lazy(() =>
  import(/* webpackChunkName: 'graph2' */ '../../../components/graph2'),
);

const firstFrameComponent = [{ frame: 0 }];

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

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
  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/rmsd-perres/`,
  );

  // Set when one point in the graph is selected
  const [selectedFrame, setSelectedFrame] = useState(null);

  // Set when one point in the graph is selected
  const [selectedResidues, setSelectedResidues] = useState([]);

  // Get the residues list in model notation
  const { xAxesStep, sequences } = useMemo(() => {
    if (!pdbData.file || !metadata || !payload) return {};

    const data = payload.data;
    // Calculate the mean and standard deviation of each residue rmsds
    // Also get the maximum and minimum means
    const means = [];
    data.forEach(residue => {
      const [mean, stdv] = getStaistics(residue.rmsds);
      residue.mean = mean;
      residue.stdv = stdv;
      means.push(mean);
    });

    const max = Math.max(...means);
    const min = Math.min(...means);

    // Set the color scale according to the maximum and minimum means
    const lowerScale = interpolateRgb('white', 'yellow');
    const higherScale = interpolateRgb('yellow', 'red');
    const colorScale = value => {
      const normalizedValue = (value - min) * (1 / (max - min));
      if (normalizedValue < 0.5) return lowerScale(normalizedValue * 2);
      else return higherScale((normalizedValue - 0.5) * 2);
    };

    const firstResidue = data[0];
    const dataLength = firstResidue.rmsds.length;
    const xAxesStep = metadata.LENGTH / (dataLength - 1);

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
        value: residueData,
        tooltip: `Mean: ${residueData.mean}\nStandard deviation: ${residueData.stdv}`,
        color: colorScale(residueData.mean),
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

    return { xAxesStep, sequences };
  }, [payload, pdbData, metadata]);

  // Get the residues list in model notation
  const selectedData = useMemo(() => {
    // Now get only the selected keys from the payload
    const selectedData = {};
    // Color the first selected residues in the graph
    selectedResidues.forEach((residue, i) => {
      const newData = { data: residue.rmsds };
      newData.color = residue.color;
      selectedData[i] = newData;
    });
    return selectedData;
  }, [selectedResidues]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!pdbData.file || !metadata) return <Loading />;

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card>
        <CardContent className={style.paper}>
          <ResidueSelector
            //modelResidues={modelResidues}
            sequences={sequences}
            selectedResiduesSetter={setSelectedResidues}
          />
        </CardContent>
      </Card>
      <Card className={style['graph']}>
        <Graph2
          yData={selectedData}
          step={xAxesStep}
          xAxisLabel={'Time (ns)'}
          yAxisLabel={'RMSd (Å)'}
          onSelect={setSelectedFrame}
          selected={selectedFrame}
        />
      </Card>
      <Card className={style.nglcard} ref={nglRef}>
        <Info
          reference={'rmsd-perres-table'}
          tooltip={
            <>
              This data table shows the selected residues list. First column
              contains residue name, which is composed by the union of the
              residue type abbreviation (e.g. ASN, ASP, CYS...) and the topology
              numeration. Next two columns provide the RMSD mean and standard
              deviation for each residue respectively. Both measures are in
              Ångstroms.
              <br />
              <br />
              Use this data table to navigate through all selected resiudes and
              set which of them must be displayed in the graph below. To do so,
              click in the first column checkbox of the residue to be
              shown/hidden.
            </>
          }
        />
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <NGLViewerWithControls
            className={style.container}
            components={firstFrameComponent}
            selectedResidues={selectedResidues.map(residue => residue.name)}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          typeof selectedFrame === 'number'
            ? {
                accession: accession,
                requestedFrame: selectedFrame,
                selectedResidues: selectedResidues.map(residue => residue.name),
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelectedFrame(previous => {
            if (viewer.requestedFrame === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelectedFrame(previous => {
            if (viewer.requestedFrame === previous) return null;
            else return previous;
          })
        }
      />
    </Suspense>
  );
};

export default RmsdPerres;
