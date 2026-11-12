import React, { useState, useContext } from 'react';
import {
  CardContent,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { PieChart } from 'react-minimal-pie-chart';
import SimpleLegend from '../../../../components/simple-legend';
import SimpleHistogram from '../../../../components/simple-histogram';
import { createPalette } from '../../../../utils/auxiliar-functions';
import { useTheme } from '@mui/material/styles';
import style from './style.module.css';
import Card from '../../../../components/animated-card';
import { ProjectCtx } from '../../../../contexts';

const CompositionOverview = () => {
  // State for composition chart type
  const [compositionChartType, setCompositionChartType] = useState('pie');
  const { metadata } = useContext(ProjectCtx);

  // Get the provided theme
  const theme = useTheme();
  const secondaryColor = theme.palette.secondary;

  // Check if there's composition data
  const compositionFields = [
    { key: 'SYSTATS', label: 'Total System Atoms', showPercentage: false },
    { key: 'SYSTRES', label: 'Total System Residues', showPercentage: false },
    { key: 'PROTATS', label: 'Protein Atoms', showPercentage: true },
    { key: 'PROTRES', label: 'Protein Residues', showPercentage: false },
    { key: 'DNAATS', label: 'DNA Atoms', showPercentage: true },
    { key: 'DNARES', label: 'DNA Residues', showPercentage: false },
    { key: 'RNAATS', label: 'RNA Atoms', showPercentage: true },
    { key: 'RNARES', label: 'RNA Residues', showPercentage: false },
    { key: 'LIPIATS', label: 'Lipid Atoms', showPercentage: true },
    { key: 'LIPIRES', label: 'Lipid Residues', showPercentage: false },
    { key: 'CARBATS', label: 'Carbohydrate Atoms', showPercentage: true },
    { key: 'CARBRES', label: 'Carbohydrate Residues', showPercentage: false },
    { key: 'SOLVATS', label: 'Solvent Atoms', showPercentage: true },
    { key: 'SOLVRES', label: 'Solvent Residues', showPercentage: false },
    { key: 'COUNCAT', label: 'Counter Cations', showPercentage: false },
    { key: 'COUNANI', label: 'Counter Anions', showPercentage: false },
    { key: 'COUNION', label: 'Total Counter Ions', showPercentage: true }
  ];

  const hasData = metadata && compositionFields.some(field => metadata[field.key] !== undefined && metadata[field.key] > 0);

  if (!hasData) return null;

  return (
    <Card className={style.card}>
      <CardContent className={style['card-content']}>
        <div className={style['composition-container']}>
          <div className={`${style['summary-list']} ${style['composition-stats']}`}>
            <Typography variant="h6" sx={{ fontSize: '1.4rem', marginBottom: '10px' }}>System Composition</Typography>
            <div className={style['decorated-list']}>
            {(() => {
              const compositionFields = [
                { key: 'SYSTATS', label: 'Total System Atoms', showPercentage: false },
                { key: 'SYSTRES', label: 'Total System Residues', showPercentage: false },
                { key: 'PROTATS', label: 'Protein Atoms', showPercentage: true},
                { key: 'PROTRES', label: 'Protein Residues', showPercentage: false },
                { key: 'DNAATS', label: 'DNA Atoms', showPercentage: true},
                { key: 'DNARES', label: 'DNA Residues', showPercentage: false },
                { key: 'RNAATS', label: 'RNA Atoms', showPercentage: true},
                { key: 'RNARES', label: 'RNA Residues', showPercentage: false },
                { key: 'LIPIATS', label: 'Lipid Atoms', showPercentage: true },
                { key: 'LIPIRES', label: 'Lipid Residues', showPercentage: false },
                { key: 'CARBATS', label: 'Carbohydrate Atoms', showPercentage: true },
                { key: 'CARBRES', label: 'Carbohydrate Residues', showPercentage: false },
                { key: 'SOLVATS', label: 'Solvent Atoms', showPercentage: true },
                { key: 'SOLVRES', label: 'Solvent Residues', showPercentage: false },
                { key: 'COUNCAT', label: 'Counter Cations', showPercentage: false },
                { key: 'COUNANI', label: 'Counter Anions', showPercentage: false },
                { key: 'NOCNION', label: 'Non Counter Ions', showPercentage: false },
                { key: 'OTHRATS', label: 'Other Atoms', showPercentage: false }
              ];
              
              const totalAtoms = metadata.SYSTATS || 0;
              
              return compositionFields
                .filter(field => metadata[field.key] !== undefined && metadata[field.key] > 0)
                .map((field, index) => {
                  const value = metadata[field.key];
                  const percentage = field.showPercentage && totalAtoms > 0 
                    ? ((value / totalAtoms) * 100).toFixed(2)
                    : null;
                  
                  return (
                    <div key={index} className={style['decorated-list-item']}>
                      <div className={style['decorated-list-item__title']}>{field.label}</div>
                      <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                        {value.toLocaleString()}
                        {percentage && ` (${percentage}%)`}
                      </div>
                    </div>
                  );
                });
            })()}
            </div>
          </div>
          <div className={style['composition-chart']}>
            {(() => {
                const compositionFields = [
                { key: 'PROTATS', label: 'Protein'},
                { key: 'DNAATS', label: 'DNA'},
                { key: 'RNAATS', label: 'RNA' },
                { key: 'LIPIATS', label: 'Lipid' },
                { key: 'CARBATS', label: 'Carbohydrate' },
                { key: 'SOLVATS', label: 'Solvent' },
                { key: 'OTHRATS', label: 'Other Atoms' }
                ];
                
                const totalAtoms = metadata.SYSTATS || 0;
                
                // Calculate total ions
                const totalIons = (metadata.COUNCAT || 0) + (metadata.COUNANI || 0) + (metadata.NOCNION || 0);
                
                const chartData = compositionFields
                .filter(field => metadata[field.key] !== undefined && metadata[field.key] > 0)
                .map(field => ({
                  ...field,
                  value: metadata[field.key],
                  percentage: totalAtoms > 0 ? ((metadata[field.key] / totalAtoms) * 100).toFixed(2) : 0
                }));
                
                // Add ions to chart data if total is greater than 0
                if (totalIons > 0) {
                chartData.push({
                  key: 'IONS',
                  label: 'Ions',
                  value: totalIons,
                  percentage: totalAtoms > 0 ? ((totalIons / totalAtoms) * 100).toFixed(2) : 0
                });
                }
                
                if (chartData.length === 0) return null;
              
              // Prepare pie chart data
              const colors = createPalette(chartData.length);
              const pieChartData = chartData.map((item, i) => ({
                title: item.label,
                value: item.value,
                color: colors[i],
              }));
              
              const legendData = chartData.map((item, i) => ({
                label: `${item.label} (${item.percentage}%)`,
                color: colors[i],
              }));
              
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <ToggleButtonGroup
                      value={compositionChartType}
                      exclusive
                      onChange={(event, newType) => {
                        if (newType !== null) {
                          setCompositionChartType(newType);
                        }
                      }}
                      size="small"
                    >
                      <ToggleButton value="pie">Pie Chart</ToggleButton>
                      <ToggleButton value="histogram">Histogram</ToggleButton>
                    </ToggleButtonGroup>
                  </div>
                  
                  {compositionChartType === 'histogram' ? (
                    <SimpleHistogram data={chartData} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '100%' }}>
                        <PieChart
                            data={pieChartData}
                            style={{ height: '100%', flex: '0 0 250px' }}
                        />
                        <SimpleLegend entries={legendData} />
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompositionOverview;
