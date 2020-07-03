import React, { useContext, useState, useRef, useMemo } from 'react';

import { CardContent, Tabs, Tab } from '@material-ui/core';

import useAPI from '../../../hooks/use-api';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';

import { AccessionCtx, ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import residueSelectionParser from '../../../utils/residue-selection-parser';

import Info from '../../../components/info';
import Selector from '../../../components/selector';
import Heatmap from '../../../components/heatmap';

import style from './style.module.css';

//import HorizontalBars from '../../../components/horizontal-bars';

const DistPerres = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project chains and metadata
  const { metadata, chains } = useContext(ProjectCtx);

  // The stored previous data after filtering
  const filteredData = useRef(null);

  // The residues selection string managed by the selector
  const [searchResidues, setSearchResidues] = useState(
    metadata.INTERFACE || '',
  );

  // The selected atoms
  const [selected, setSelected] = useState(null);

  // The graphic to be displayed ('mean' or 'stdv')
  const [display, setDisplay] = useState('mean');

  // Set the API url for the heatmap data
  const url = `${BASE_PATH_PROJECTS}${accession}/analyses/dist-perres/`;

  const { loading, payload, error } = useAPI(url);

  // Filter data by selected residues
  useMemo(() => {
    // Return if the payload is not ready
    if (loading || error || !payload) return;

    // Return the intact payload if there is no selection
    if (!searchResidues) {
      filteredData.current = payload;
      return;
    }
    // Otherwise, filter the payload to get only specified residues

    // Parse the selection string into a numeric array
    const curatedSelection = residueSelectionParser(searchResidues);

    // Set new data
    const xLabels = [];
    const yLabels = [];

    for (const res of curatedSelection) {
      if (payload.xLabels.includes(res)) {
        xLabels.push(res);
      } else if (payload.yLabels.includes(res)) {
        yLabels.push(res);
      } else {
        console.error('Residue not found');
      }
    }

    // Harvest the right meand and stdv values according to selected indexes
    const mean = [];
    const stdv = [];
    for (const y of yLabels) {
      const yIndex = payload.yLabels.indexOf(y);
      const newMeanRow = [];
      const newStdvRow = [];
      for (const x of xLabels) {
        const xIndex = payload.xLabels.indexOf(x);
        newMeanRow.push(payload.mean[yIndex][xIndex]);
        newStdvRow.push(payload.stdv[yIndex][xIndex]);
      }
      mean.push(newMeanRow);
      stdv.push(newStdvRow);
    }

    // Finally create the heatmap input data sets
    filteredData.current = {
      xLabels: xLabels,
      yLabels: yLabels,
      mean: mean,
      stdv: stdv,
    };
    //console.log(filteredData.current);
  }, [loading, error, payload, searchResidues]);
  //console.log(filteredData.current);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  // If any of the labels is empty we can't render the heatmap
  //if (filteredData.current.xLabels.length === 0 || filteredData.current.yLabels.length === 0)
  //return 'Analysis error: At least one of the dimensions is empty'

  // Set the chains to be represented in the NGL viewer
  const chainsNGL = [];
  for (const chain of chains) {
    chainsNGL.push({
      name: 'Chain ' + chain,
      selection: ':' + chain,
    });
  }

  // Set which options will be available in the resiude selector
  const selectorOptions = [{ label: 'All', value: '' }];
  if (metadata.INTERFACE)
    selectorOptions.push({ label: 'Interface', value: metadata.INTERFACE });

  // handles when the tabs are switched
  const handleTabs = (event, newValue) => {
    setDisplay(newValue);
  };

  // Render
  return (
    <>
      <Card className={style.card}>
        <Info
          reference={'dist-perres-selector'}
          tooltip={
            <>
              This is the residues selector.
              <br />
              <br />
              Use this panel to select which residues are displayed in the
              heatmap below. Some default residue groups are provided by the
              authors (e.g. interface residues between two proteins).
            </>
          }
        />
        <CardContent>
          <Selector
            label="Residues selection"
            selection={searchResidues}
            setter={setSearchResidues}
            options={selectorOptions}
            //custom
          />
        </CardContent>
      </Card>
      <Card className={style.margined}>
        <Info
          reference={'dist-perres-heatmap'}
          tooltip={
            <>
              This is the distance per residue representation.
              <br />
              <br />
              This heatmap represents the distance between selected residues
              from different proteins. Both horizontal and vertical edges stand
              for residue numbers. The color stands for the distance and it
              ranges from blue (far) to red (close). The legend below shows the
              corresponding values in angstroms.
              <br />
              <br />
              Use tabs over the heatmap to switch between mean and standard
              deviation.
              <br />
              <br />
              <span style={{ color: 'lightGreen' }}> Click any cell </span>
              on the heatmap to open an interactive window displaying the
              trajectory with the corresponding highlighted residues.
            </>
          }
        />
        <CardContent>
          <Tabs
            value={display}
            variant="fullWidth"
            indicatorColor="secondary"
            textColor="secondary"
            onChange={handleTabs}
            className={style['margined-bottom']}
          >
            <Tab
              value={'mean'}
              label="Residues distance averages"
              //className={style['disabled-tab']}
            />
            <Tab value={'stdv'} label="Residues distance standard deviations" />
          </Tabs>
          {/* For more than one resiude in the 'y' */}
          <Heatmap
            inputData={{
              data: filteredData.current[display],
              xLabels: filteredData.current.xLabels,
              yLabels: filteredData.current.yLabels,
            }}
            onClick={(x, y) => setSelected([x, y])}
            legendTitle={
              display === 'mean'
                ? 'Distance average (Å)'
                : 'Distance standard deviation (Å)'
            }
            // Invert colors here, since minimum values belong to closer residues
            maxValueColor={{ r: 0, g: 0, b: 255 }}
            minValueColor={{ r: 255, g: 0, b: 0 }}
          />
          {/*filteredData.current.yLabels.length !== 1 ?
        // For more than one resiude in the 'y'
        <Heatmap
          inputData={{
            data: filteredData.current.mean,
            xLabels: filteredData.current.xLabels,
            yLabels: filteredData.current.yLabels,
          }}
          onClick={(x, y) => setSelected([residue2atom(x), residue2atom(y)])}
          legendTitle={'Distance average (Å)'}
          // Invert colors here, since minimum values belong to closer residues
          maxValueColor={{ r: 0, g: 0, b: 255 }}
          minValueColor={{ r: 255, g: 0, b: 0 }}
        />:
        // For only one resiude in the 'y'
        <HorizontalBars
          data={filteredData.current.mean[0]}
          ylabels={filteredData.current.xLabels}
          height={20 * filteredData.current.mean[0].length}
          selected={selected}
          onClick={index => { 
            setSelected(index);
          }}
        />*/}
        </CardContent>
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          selected
            ? {
                accession: accession,
                selectedResidues: selected,
                representations: chainsNGL,
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelected(previous => {
            if (viewer.selectedResidues === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelected(previous => {
            if (viewer.selectedResidues === previous) return null;
            else return previous;
          })
        }
      />
    </>
  );
};

export default DistPerres;
