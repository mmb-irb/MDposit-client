import React, { lazy, Suspense, useState, useContext, useMemo, useEffect, useRef } from 'react';

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
  Typography,
} from '@mui/material';

import Card from '../../../components/animated-card';
import ViewerSpawner from '../../../components/viewer-spawner';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';
import { ProjectCtx } from '../../../contexts';
import { BASE_PATH_PROJECTS } from '../../../utils/constants';
import { getMeanAndStdv } from '../../../utils/statistics';

import style from './style.module.css';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

const colors = ['black', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'];

const LipidOrder = () => {
  const { accession, accessionAndMdNumber} = useContext(ProjectCtx);
  // Send a request to the API with the url of the specific analysis
  const {
    loading,
    payload,
    error,
  } = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/lipid-order/`);
  // Get the membrane map
  const {
    loading: memMapLoading,
    payload: memMapPayload,
    error: memMapError,
} = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/mem-map/`);

  // Add state for selected lipid type
  const [selectedLipid, setSelectedLipid] = useState(null);
  const [display, setDisplay] = useState({});
  const [xSelected, setXSelected] = useState(null);
  const [representations, setRepresentations] = useState(null);
  const [flipY, setFlipY] = useState(false);
  const [showStdDev, setShowStdDev] = useState(true);

  // Get available lipid types for tabs
  const lipidTypes = useMemo(() => {
    if (!payload) return [];
    return Object.keys(payload.data);
  }, [payload]);

  // Set initial selected lipid when data loads
  useMemo(() => {
    if (lipidTypes.length && !selectedLipid) {
      setSelectedLipid(lipidTypes[0]);
    }
  }, [lipidTypes, selectedLipid]);

  const orderParameters = useMemo(() => {
    if (!payload || !selectedLipid || !memMapPayload || !memMapPayload.references) return {};
    
    const orderParams = {};
    const defaultDisplay = {};

    const chains = payload.data[selectedLipid];
    Object.entries(chains).forEach(([chainId, chainData]) => {
      const tailName = `${memMapPayload.references[selectedLipid].resname} tail ${parseInt(chainId) + 1}`;
      const dataset = {
        data: chainData.avg.map(v => flipY ? -v : v),
        areaStdDev: chainData.std,
        labels: chainData.atoms,
        color: colors[parseInt(chainId) % colors.length],
      };
      const { mean: average, stdv: stddev } = getMeanAndStdv(dataset.data);
      dataset.average = average;
      dataset.stddev = stddev;
      orderParams[tailName] = dataset;
      defaultDisplay[tailName] = true;
    });
    setDisplay(defaultDisplay);
    return orderParams;
  }, [payload, selectedLipid, flipY, memMapPayload]);

  const maxStd = useMemo(() => {
    if (!orderParameters || !display) return 0;
    return Math.max(
      ...Object.entries(orderParameters)
        .filter(([key]) => display[key])
        .map(([_, data]) => Math.max(...(data.areaStdDev || [])))
    );
  }, [orderParameters, display]);

  const baseLipidRep = useMemo(() => {
    if (!display || !orderParameters || !memMapPayload) return;
    return {
      'name': memMapPayload.references[selectedLipid].resname,
      'type': 'licorice',
      'color': 'orange',
      'opacity': 0.5,
      'selection': `( ${memMapPayload.references[selectedLipid].indices} )`,
      'reference': selectedLipid,
      'show': true,
    };
  }, [selectedLipid, memMapPayload]);

  // Define representations when data changes
  useEffect(() => {
    if (!display || !orderParameters || !memMapPayload) return;

    const reps = [baseLipidRep];
    if (xSelected !== null) {
      // Iterate through orderParameters[selectedLipid] dictionary keys
      Object.keys(orderParameters).forEach((tailName, index) => {
        const atomName = orderParameters[tailName].labels[xSelected];
        if (!atomName) return;
        reps.push({
          'name': `${atomName}`,
          'type': 'ball+stick',
          'color': colors[index % colors.length],
          'opacity': 0.9,
          'selection': `( ${memMapPayload.references[selectedLipid].indices} ) and .${atomName}`,
          'other': { radius: 0.3 },
          'show': display[tailName],
          'reference': `${selectedLipid} ${index}`,

        });
      });
    }
    setRepresentations(reps);
  }, [baseLipidRep, selectedLipid, xSelected, display, orderParameters, memMapPayload]);

  // Create marks for graph highlighting
  const marks = useMemo(() => {
    return xSelected !== null ? [{
      x: xSelected,
      attr: { fill: '#c8c8c8' },
    }] : [];
  }, [xSelected]);

  if (loading) return <Loading />;
  if (error) return error.toString();
  if (!payload || !memMapPayload) return 'Something bad happened with Lipid Order analysis';

  const cents = num => Math.round(num * 100) / 100;

  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <CardContent>
          <Tabs
            value={selectedLipid}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
            onChange={(event, value) => {
              setSelectedLipid(value);
            }}
            className={style['margined-bottom']}
          >
            {lipidTypes.map((lipid) => (
              <Tab
                key={lipid}
                value={lipid}
                label={
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span >
                      {memMapPayload?.references?.[lipid]?.resname || lipid}
                    </span>
                    <Typography variant="caption" color="text.secondary">
                      {/* Add your subtitle here */}
                      {memMapPayload?.references?.[lipid]?.lipidmaps.name || 'Lipid'}
                    </Typography>
                  </div>
                }
              />
            ))}
          </Tabs>
          <Table padding="checkbox">
            <TableHead>
              <TableRow>
                <TableCell>Lipid</TableCell>
                <TableCell>Mean Order Parameter</TableCell>
                <TableCell>Standard Deviation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(orderParameters).map(([key, data], i) => (
                <TableRow key={key}>
                  <TableCell>
                    <FormControlLabel
                      onChange={() =>
                        setDisplay(previous => ({
                          ...previous,
                          [key]: !previous[key],
                        }))
                      }
                      control={
                        <Checkbox
                          checked={display[key]}
                          style={{ color: data.color }}
                        />
                      }
                      label={key}
                    />
                  </TableCell>
                  <TableCell>{cents(data.average)}</TableCell>
                  <TableCell>{cents(data.stddev)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
        </CardContent>
      </Card>
      <Card className={style.card}>
      <FormControlLabel
        control={
          <Checkbox
            checked={flipY}
            onChange={(e) => setFlipY(e.target.checked)}
          />
        }
        label="Invert Y-axis values"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={showStdDev}
            onChange={(e) => setShowStdDev(e.target.checked)}
          />
        }
        label="Show standard deviation"
      />
      <CardContent>
        <Graph
          yData={orderParameters}
          xAxisLabel="Carbon Position"
          yAxisLabel="Order Parameter"
          type="line"
          selfLegend={false}
          dataDisplay={display}
          labelsOnHover={true}
          xTooltip={(_, xIndex) => `Position ${xIndex + 1}`}
          onSelect={setXSelected}
          marks={marks}
          areaStdDev={showStdDev}
          yPadding={showStdDev ? maxStd : 0}
        />
      </CardContent>
      </Card>
      <ViewerSpawner
        newViewer={
          typeof xSelected === 'number'
            ? {
              accession: accession,
              xSelection: xSelected,
              representationsState: [representations, setRepresentations]
            }
            : null
        }
        onNail={viewer =>
          setXSelected(previous => {
            if (viewer.xSelection === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setXSelected(previous => {
            if (viewer.xSelection === previous) return null;
            else return previous;
          })
        }
      />
    </Suspense>
  );
};

export default LipidOrder;
