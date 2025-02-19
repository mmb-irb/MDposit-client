import React, { useContext, useState, useMemo } from 'react';
import { CardContent, Tabs, Tab } from '@mui/material';
import useAPI from '../../../hooks/use-api';
import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import { ProjectCtx } from '../../../contexts';
import { BASE_PATH_PROJECTS } from '../../../utils/constants';
import Heatmap from '../../../components/heatmap';
import ColorLegend from '../../../components/color-legend';
import style from './style.module.css';


const AreaPerLipid = () => {
  const { accessionAndMdNumber } = useContext(ProjectCtx);
  const url = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/apl/`;
  const { loading, payload, error } = useAPI(url);

  // Process the data for both heatmaps
  const heatmapData = useMemo(() => {
    if (loading || error || !payload) return null;

    const processLeaflet = (leaflet) => {
      const grid = payload.data[leaflet];
      for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[i].length; j++) {
          if (grid[i][j] < 0) {
            grid[i][j] = NaN;
          }
        }
      }
      const xLabels = payload.data.grid_x.map(x => Math.round(x * 100) / 100);
      const yLabels = payload.data.grid_y.map(y => Math.round(y * 100) / 100);
      yLabels.reverse();
      grid.reverse();
      return { data: grid, xLabels, yLabels };
    };
    const minValue = Math.round((payload.data.median - payload.data.std)*100)/100;
    const maxValue = Math.round((payload.data.median + payload.data.std)*100)/100;
    console.log('minValue', minValue);
    console.log('maxValue', maxValue);

    return {
      upper: processLeaflet('upper leaflet'),
      lower: processLeaflet('lower leaflet'),
      minValue,
      maxValue,
    };
  }, [loading, error, payload]);

  const handleHeatmapTooltip = ({ value, xAxisValue, yAxisValue }) =>
    `Position (${xAxisValue}, ${yAxisValue})\nArea per lipid: ${Math.round(value * 100) / 100} Å²`;

  if (loading) return <Loading />;
  if (error) return error.toString();
  if (!payload) return 'Something bad happened';

  return (
    <div>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <Card className={style.margined} id="upper-heatmap" style={{ flex: 1 }}>
          <CardContent>
            <h3>Upper Leaflet</h3>
            <Heatmap
              inputData={heatmapData.upper}
              onTooltip={handleHeatmapTooltip}
              legendTitle=""
              xTitle="X coordinate (Å)"
              yTitle="Y coordinate (Å)"
            />
          </CardContent>
        </Card>
        <Card className={style.margined} id="lower-heatmap" style={{ flex: 1 }}>
          <CardContent>
            <h3>Lower Leaflet</h3>
            <Heatmap
              inputData={heatmapData.lower}
              onTooltip={handleHeatmapTooltip}
              legendTitle = ""
              xTitle="X coordinate (Å)"
              yTitle="Y coordinate (Å)"
            />
          </CardContent>
        </Card>
      </div>
      <Card className={style.legend}>
        <CardContent>
            <ColorLegend
              title="Area per lipid (Å²)"
              minValue={heatmapData.minValue}
              maxValue={heatmapData.maxValue}
              colorPlan={['red', 'white', 'blue']}
              className={style.legend}
            />
        </CardContent>
      </Card>
    </div>
  );
};

export default AreaPerLipid;