import React, { useContext, useState } from 'react';

import { CardContent, Tabs, Tab } from '@material-ui/core';

import useAPI from '../../../hooks/use-api';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';

import { AccessionCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

import Info from '../../../components/info';
import Heatmap from '../../../components/heatmap';

const RmsdPairwise = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);

  // The selected frames
  const [selected, setSelected] = useState(null);

  // The graphic to be displayed ('all' or 'interface')
  const [display, setDisplay] = useState('all');

  // Set the API url for the heatmap data
  const url = `${BASE_PATH_PROJECTS}${accession}/analyses/rmsd-pairwise/`;

  const { loading, payload, error } = useAPI(url);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  // Set the frames to be represented in the NGL viewer
  const components = [];
  if (selected)
    selected.forEach((frame, index) => {
      components.push({
        frame: frame,
        representations: [
          {
            name: 'Frame ' + frame,
            defaultColoringMethod: index === 0 ? 'red' : 'blue',
          },
        ],
      });
    });

  // handles when the tabs are switched
  const handleTabs = (event, newValue) => {
    setDisplay(newValue);
  };

  // Render
  return (
    <>
      <Card className={style.margined} id="heatmap">
        <Info
          reference={'rmsd-pairwise-heatmap'}
          tooltip={
            <>
              This is the RMSd pairwise representation.
              <br />
              <br />
              This heatmap represents the RMSd in the average atom positions
              between each frame along the trajectory. Both horizontal and
              vertical edges stand for frame numbers. The color stands for the
              RMSd value and it ranges from blue (low) to red (high). The legend
              below shows the corresponding values in Ångstroms.
              <br />
              <br />
              Use tabs over the heatmap to switch between different RMSd
              pairwise analyses. Each analysis is calculated with a different
              selection of atoms/residues which have been suggested to be
              relevant by the authors.
              <br />
              <br />
              <span style={{ color: 'lightGreen' }}> Click any cell </span>
              on the heatmap to open an interactive window displaying both
              corresponding frames overlapped.
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
              value={'all'}
              label="RMSD pairwise"
              //className={style['disabled-tab']}
            />
            <Tab value={'interface'} label="Interface RMSD pairwise" />
          </Tabs>
          <Heatmap
            inputData={{
              data: payload[display],
              xLabels: payload.xLabels,
              yLabels: payload.yLabels,
            }}
            onClick={(x, y) => setSelected([x, y])}
            legendTitle={'RMSD (Å)'}
          />
        </CardContent>
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          selected
            ? {
                accession: accession,
                components: components,
                selRef: selected,
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelected(previous => {
            if (viewer.selRef === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelected(previous => {
            if (viewer.selRef === previous) return null;
            else return previous;
          })
        }
      />
    </>
  );
};

export default RmsdPairwise;
