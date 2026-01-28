import React, { useState, useCallback } from 'react';
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
 */

const PieChart = ({ data, legendData, className, pieClassName, legendClassName }) => {
  // Track which indices are hidden
  const [hiddenIndices, setHiddenIndices] = useState([]);

  // Toggle visibility of a slice
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
