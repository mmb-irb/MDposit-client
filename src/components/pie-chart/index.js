import React, { useEffect, useState, useCallback } from 'react';
import { PieChart as MinimalPieChart } from 'react-minimal-pie-chart';
import SimpleLegend from '../simple-legend';
import style from './style.module.css';

/**
 * PieChart component with legend
 * @param {Object[]} data - Data for the pie chart [{ title, value, color }]
 * @param {Object[]} legendData - Data for the legend [{ label, color }]
 * @param {string} [className] - Optional className for the container
 * @param {string} [pieClassName] - Optional className for the pie chart
 * @param {string} [legendClassName] - Optional className for the legend
 * @param {boolean} [autoHide] - If true, automatically hide slices >99% or <1% of total
 */

const PieChart = ({ data, legendData, className, pieClassName, legendClassName, autoHide = false }) => {
  // Compute indices to auto-hide if enabled
  const computeAutoHidden = (data) => {
    if (!autoHide || !data || data.length < 3) return [];
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const bigIndices = data
      .map((d, i) => ({ idx: i, frac: total > 0 ? d.value / total : 0 }))
      .filter(d => d.frac > 0.98)
      .map(d => d.idx);
    const smallIndices = data
      .map((d, i) => ({ idx: i, frac: total > 0 ? d.value / total : 0 }))
      .filter(d => d.frac < 0.01)
      .map(d => d.idx);
    if (bigIndices.length > 0) {
      return bigIndices;
    } else if (smallIndices.length < data.length) {
      return smallIndices;
    }
    return [];
  };

  // Track which indices are hidden (initialize with autoHidden on mount/data change)
  const [hiddenIndices, setHiddenIndices] = useState(() => computeAutoHidden(data));

  // Update hiddenIndices if data or autoHide changes
  useEffect(() => {
    setHiddenIndices(computeAutoHidden(data));
  }, [data, autoHide]);

  // Toggle visibility of a slice (user interaction)
  const handleLegendClick = useCallback(idx => {
    setHiddenIndices(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  }, []);

  // Filter data for PieChart
  const filteredData = data
    ? data.map((entry, i) => hiddenIndices.includes(i) ? { ...entry, value: 0 } : entry)
    : [];

  // Enhance legend entries with onClick and hidden state
  const legendEntries = legendData
    ? legendData.map((entry, i) => ({
        ...entry,
        onClick: () => handleLegendClick(i),
        hidden: hiddenIndices.includes(i),
      }))
    : [];

  return (
    <div className={className ? className : style.horizontal}>
      <MinimalPieChart
        data={filteredData}
        className={pieClassName ? pieClassName : style.piechart}
      />
      {legendData && (
        <SimpleLegend
          entries={legendEntries}
          className={legendClassName ? legendClassName : style.legend}
        />
      )}
    </div>
  );
};

export default PieChart;
