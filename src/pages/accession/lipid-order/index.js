import React, { lazy, Suspense, useState, useContext, useMemo, useEffect } from 'react';

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
import { getMeanAndStdv } from '../../../utils/statistics';

import style from './style.module.css';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

const colors = ['black', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'];

const LipidOrder = () => {
  const { accession, accessionAndMdNumber, metadata, analyses } = useContext(ProjectCtx);

  const {
    loading,
    payload,
    error,
  } = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/lipid-order/`);

  // Add state for selected lipid type
  const [selectedLipid, setSelectedLipid] = useState(null);
  const [display, setDisplay] = useState({});
  const [xSelected, setXSelected] = useState(null);
  const [representations, setRepresentations] = useState(null);
  const [flipY, setFlipY] = useState(true);

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
    if (!payload || !selectedLipid) return {};
    
    const orderParams = {};
    const defaultDisplay = {};
    
    const chains = payload.data[selectedLipid];
    chains.forEach((chain, chainIndex) => {
      const name = `${selectedLipid} tail ${chainIndex + 1}`;
      const dataset = {
        data: Object.values(chain).map(v => flipY ? -v : v),
        labels: Object.keys(chain),
        color: colors[chainIndex % colors.length],
      };
      const { mean: average, stdv: stddev } = getMeanAndStdv(dataset.data);
      dataset.average = average;
      dataset.stddev = stddev;
      orderParams[name] = dataset;
      defaultDisplay[name] = true;
    });

    setDisplay(defaultDisplay);
    return orderParams;
  }, [payload, selectedLipid, flipY]);

  // Define representations when data changes
  useEffect(() => {
    if (!display || !orderParameters) return;
    const reps = [{
      'name': selectedLipid,
      'type': 'licorice',
      'color': 'orange',
      'opacity': 0.5,
      'selection': `${selectedLipid}`,
    }];

    if (xSelected !== null) {
      // Iterate through orderParameters[selectedLipid] dictionary keys
      Object.keys(orderParameters).forEach((tail, index) => {
        const atomName = orderParameters[tail].labels[xSelected];
        if (!atomName) return;
        reps.push({
        'name': `${atomName}`,
        'type': 'ball+stick',
        'color': colors[index % colors.length],
        'opacity': 0.9,
        'selection': `${selectedLipid} and .${atomName}`,
        'other': { radius: 0.3 },
        'show': display[tail],
        });
      });
    }
    setRepresentations(reps);
  }, [selectedLipid, xSelected, display]);

  // Create marks for graph highlighting
  const marks = useMemo(() => {
    return xSelected !== null ? [{
      x: xSelected,
      attr: { fill: '#c8c8c8' },
    }] : [];
  }, [xSelected]);

  if (loading) return <Loading />;
  if (error) return error.toString();
  if (!payload) return 'Something bad happened with Lipid Order analysis';

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
                label={lipid}
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
