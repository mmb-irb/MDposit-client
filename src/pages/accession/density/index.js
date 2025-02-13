import React, { lazy, Suspense, useState, useContext, useMemo } from 'react';

import {
  CardContent,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  FormControlLabel,
  Checkbox,
  Tabs,
  Tab,
} from '@mui/material';

import Card from '../../../components/animated-card';
import ViewerSpawner from '../../../components/viewer-spawner';
import Loading from '../../../components/loading';
import useAPI from '../../../hooks/use-api';
import { ProjectCtx } from '../../../contexts';
import { BASE_PATH_PROJECTS } from '../../../utils/constants';
import { getMean } from '../../../utils/statistics';
import style from './style.module.css';
import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

const tabs = [
  // about the units: http://archive.ambermd.org/202203/0008.html
  { type: 'mass', label: 'Mass', ylabel: 'Density (Da/Å)' },
  { type: 'number', label: 'Number', ylabel: 'Density (N/Å)' },
  //{ type: 'charge', label: 'Charge' }, // disable until we can put charges in pytraj topology
  { type: 'electron', label: 'Electron', ylabel: 'Density (e⁻/Å)' },
];

const colors = ['black', 'blue', 'purple','red', 'orange', 'yellow','green'  ];

const Density = () => {
  // Get the metadata
  const { accession, accessionAndMdNumber, metadata, analyses } = useContext(ProjectCtx);

  // Send a request to the API with the url of the specific analysis
  const {
    loading: densityLoading,
    payload: densityPayload,
    error: densityError,
  } = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/density/`);
  // Get the membrane map
  const {
    loading: memMapLoading,
    payload: memMapPayload,
    error: memMapError,
  } = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/mem-map/`);

  // Set which tab is selected
  const [selectedTab, setSelectedTab] = useState(tabs[0]);
  // Set which density components to display
  const [display, setDisplay] = useState({});

  // Format the data
  const {
    densityData,
    frameStep,
    xAxisStep,
    xAxisLabel,
    isEnsemble,
    xTooltip,
  } = useMemo(() => {
    if (!densityPayload || !densityPayload.data || !densityPayload.data.comps) return {};

    const densityData = {};
    const defaultDisplay = {};
    
    // Process each component's density data
    densityPayload.data.comps.forEach((comp, index) => {
      const dataset = {};
      const type = selectedTab.type;
      dataset.data = comp[type].dens;
      dataset.color = colors[index % colors.length];
      
      // Calculate mean and stddev for the table display
      dataset.average = getMean(dataset.data);
      dataset.stddev = getMean(comp[type].stdv);
      
      // Add the density stddev from the JSON for the graph visualization
      dataset.areaStdDev = comp[type].stdv;
      
      const name = comp.name;
      densityData[name] = dataset;
      defaultDisplay[name] = true;
    });

    setDisplay(defaultDisplay);
    const isEnsemble = metadata.TYPE === 'ensemble';
    // Calculate timestep from z-axis data
    const zValues = densityPayload.data.z;
    const xStep = zValues[1] - zValues[0]; // Difference between first two points

    return {
      densityData,
      frameStep: 1,
      xAxisStep: xStep,
      xAxisLabel: 'Z axis (Å)', // Using Angstroms as label
      isEnsemble,
      xTooltip: xValue => `${xValue.toFixed(2)} Å`,
      xValues: zValues, // Add z values for x-axis
    };
  }, [metadata, densityPayload, selectedTab]);

  // Set when one point in the graph is selected
  const [selected, setSelected] = useState(null);
  const selectedFrame = selected * frameStep;

  // Set the mark for selected
  const marks = useMemo(() => {
    const selectedMark = {
      x: selected,
      attr: { fill: '#c8c8c8' },
    };
    return [selectedMark];
  }, [selected]);

  // Use default representations hook
  const defaultRepresentations = useDefaultRepresentations();
  // Define the representations to be displayed in the viewer
  const [representations, setRepresentations] = useState(null);
  // Set or update the representations state
  useMemo(() => {
    if (!densityPayload || !densityPayload.data) return;
    if (!defaultRepresentations || defaultRepresentations.length === 0) return;
    setRepresentations(previous => {
      if (previous !== null) return previous;
      defaultRepresentations.forEach((rep, index) => {
        rep.color = colors[index % colors.length];
      });
      return [...defaultRepresentations];
    });
  }, [defaultRepresentations]);

  // Render loading or error states
  if (densityLoading) return <Loading />;
  else if (densityError) return densityError.toString();
  else if (!densityPayload) return 'Something bad happened loading density data';

  const cents = num => Math.round(num * 100) / 100;
  // Set the y axis label for density

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <CardContent>
        <Tabs
            value={selectedTab}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
            onChange={(event, value) => {
              setSelected(null);
              setSelectedTab(value);
            }}
            className={style['margined-bottom']}
          >
            {tabs.map((tab, t) => (
              <Tab
                key={t}
                value={tab}
                label={tab.label}
              />
            ))}
          </Tabs>
          <Table padding="checkbox">
            <TableHead>
              <TableRow>
                <TableCell>selected chains</TableCell>
                <TableCell>{`mean`}</TableCell>
                <TableCell>{`mean of standard deviations`}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(densityData).map(([key, density], i) => (
                <TableRow key={key}>
                  <TableCell>
                    {
                      <FormControlLabel
                        onChange={() =>
                          setDisplay(previous => {
                            previous[key] = !previous[key];
                            return { ...previous };
                          })
                        }
                        control={
                          <Checkbox
                            checked={display[key]}
                            style={{ color: colors[i] }}
                          />
                        }
                        label={key}
                      />
                    }
                  </TableCell>
                  <TableCell>{cents(density.average)}</TableCell>
                  <TableCell>{cents(density.stddev)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className={style.card}>
        <CardContent>
          <Graph
            yData={densityData}
            step={xAxisStep}
            xAxisLabel={xAxisLabel}
            yAxisLabel={selectedTab.ylabel}
            type={isEnsemble ? 'dots' : 'line'}
            xTooltip={xTooltip}
            xScaleFactor={1}
            onSelect={setSelected}
            selfLegend={false}
            dataDisplay={display}
            marks={marks}
            areaStdDev={true}
          />
        </CardContent>
      </Card>
      <ViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          typeof selected === 'number'
            ? {
              accession: accession,
              // This is used only as a tag for the onNail and onClose functions below
              // It has no effect on the viewer
              xSelection: selected,
              xAxisStep: xAxisStep,
              representationsState: [representations, setRepresentations]
            }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelected(previous => {
            if (viewer.xSelection === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelected(previous => {
            if (viewer.xSelection === previous) return null;
            else return previous;
          })
        }
      />
    </Suspense>
  );
};

export default Density;
