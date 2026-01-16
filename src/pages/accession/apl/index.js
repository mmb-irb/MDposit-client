import React, { useContext, useState, useMemo } from 'react';
import { CardContent, Slider } from '@mui/material';
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
  const [stdDevs, setStdDevs] = useState(1.0);
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
      const xLabels = payload.data.grid_x.map(x => x.toFixed(2));
      const yLabels = payload.data.grid_y.map(y => y.toFixed(2));
      yLabels.reverse();
      grid.reverse();
      return { data: grid, xLabels, yLabels };
    };
    return {
      upper: processLeaflet('upper leaflet'),
      lower: processLeaflet('lower leaflet'),
      median: payload.data.median,
      std: payload.data.std,
    };
  }, [loading, error, payload]);


  const { minValue, maxValue } = useMemo(() => {
    if (!heatmapData || !heatmapData.median) return { minValue: 0, maxValue: 0 };
    return {
      minValue: Math.round((heatmapData.median - (stdDevs * heatmapData.std))*100)/100,
      maxValue: Math.round((heatmapData.median + (stdDevs * heatmapData.std))*100)/100,
    };
  }, [heatmapData, stdDevs]);

  const handleStdChange = (event, newValue) => {
    setStdDevs(newValue);
  };

  const handleHeatmapTooltip = ({ value, xAxisValue, yAxisValue }) =>
    `Position (${xAxisValue}, ${yAxisValue})\nArea per lipid: ${value.toFixed(0)} Å²`;

  if (loading) return <Loading />;
  if (error) return error.toString();
  if (!payload) return 'Something bad happened';

  return (
    <div>
      <Card className={style.container}>
        <div className={style.plot}>
          <CardContent>
            <h3 style={{'padding-left': '30px'}}>Upper Leaflet</h3>
            <Heatmap
              inputData={heatmapData.upper}
              onTooltip={handleHeatmapTooltip}
              legendTitle=""
              xTitle="X coordinate (Å)"
              yTitle="Y coordinate (Å)"
              minValue={minValue}
              maxValue={maxValue}
            />
          </CardContent>
        </div>
        <div  className={style.plot}>
          <CardContent>
            <h3 style={{'padding-left': '30px'}}>Lower Leaflet</h3>
            <Heatmap
              inputData={heatmapData.lower}
              onTooltip={handleHeatmapTooltip}
              legendTitle = ""
              xTitle="X coordinate (Å)"
              yTitle="Y coordinate (Å)"
              minValue={minValue}
              maxValue={maxValue}
            />
          </CardContent>
        </div>
        <div className={style.legend}>
          <CardContent style={{'padding-top': '0px'}}>
            <ColorLegend
              title="Area per lipid (Å²)"
              minValue={minValue}
              maxValue={maxValue}
              colorPlan={['red', 'white', 'blue']}
              className={style.legend}
            />
            <div className={style.slider}>  
              <Slider
                
                size="small"
                value={stdDevs}
                onChange={handleStdChange}
                aria-label="Standard deviations"
                valueLabelDisplay="auto"
                min={0.1}
                max={3}
                step={0.1}
                marks={[
                  { value: 0.1, label: '0.1σ' },
                  { value: 0.5, label: '0.5σ' },
                  { value: 1, label: '1σ' },
                  { value: 2, label: '2σ' },
                  { value: 3, label: '3σ' },
                ]}
              />
            </div>
          </CardContent>
      </div>
      </Card>
      
      
    </div>
  );
};

export default AreaPerLipid;