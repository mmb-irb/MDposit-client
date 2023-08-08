// React logic
import React, { useRef, useEffect, createRef, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';

// Visual assets
import { MenuList, MenuItem, Typography } from '@mui/material';

// All text to be displayed is set previously here
import { documentation } from './documentation';

import { BASE_PATH_PROJECTS, COLLECTION_NAMES } from '../../utils/constants';
import useAPI from '../../hooks/use-api'; // API acces

import style from './style.module.css';

import { PieChart } from 'react-minimal-pie-chart';
import distinctColors from 'distinct-colors';
import SimpleLegend from '../../components/simple-legend';
import Histogram from '../../components/histogram';

// Save the original introduction children
const introductionChildren = [
  ...documentation.find(doc => doc.id === 'introduction').children,
];

// Build and inject the statistics component to the documentation
// Note that this component is injected when data is not yet downloaded as a placeholder
// This prevents suddent vertical shifts as data is being downloaded
const useStatistics = () => {
  // Use the API to get the summary
  const summaryUrl = `${BASE_PATH_PROJECTS}/summary`;
  const { payload: summaryPayload, error: summaryError } = useAPI(summaryUrl);
  // Build the summary component
  // If summary data is not yet downloaded then replace their values with 'Loading...' messages
  const SummaryComponent = useMemo(() => {
    return (
      <>
        Total number of simulations:{' '}
        {summaryPayload ? summaryPayload.projectsCount : 'Loading...'}
        <br />
        Total amount of simulation time (μs):{' '}
        {summaryPayload ? Math.round(summaryPayload.totalTime / 1000) : 'Loading...'}
        <br />
        Total amount of frames:{' '}
        {summaryPayload ? summaryPayload.totalFrames : 'Loading...'}
        <br />
        Total number of stored files:{' '}
        {summaryPayload ? summaryPayload.totalFiles : 'Loading...'}
        <br />
        Total number of stored analyses:{' '}
        {summaryPayload ? summaryPayload.totalAnalyses : 'Loading...'}
      </>
    )
  }, [summaryPayload]);

  // Use the API to get the collections options
  const collectionsUrl = `${BASE_PATH_PROJECTS}/options?projection=metadata.COLLECTIONS`;
  const { payload: collectionsPayload, error: collectionsError } = useAPI(
    collectionsUrl,
  );

  // Build the collections component
  // If collections data is not yet downloaded then show a blank pie chart
  const CollectionsComponent = useMemo(() => {
    // Set the data to be represented on the pie chart
    const collections =
      collectionsPayload &&
      Object.entries(collectionsPayload['metadata.COLLECTIONS']);
    if (collections) collections.sort((a, b) => b[1] - a[1]);
    const colors = collections && distinctColors({ count: collections.length });
    const pieChartData = collections
      ? collections.map(([key, value], i) => ({
          title: COLLECTION_NAMES.get(key) || key,
          value: value,
          color: colors[i],
        }))
      : [{ title: 'Loading...', value: 1, color: 'lightgrey' }];

    // Set the legend
    const summatory = collections && collections.reduce((current_value, [key, value]) => current_value + value, 0);
    const legendData =
      collections &&
      collections.map(([key, value], i) => ({
        label: (COLLECTION_NAMES.get(key) || key) + ' (' + (Math.round((value / summatory) * 10000 ) / 100) + ' %)',
        color: colors[i],
      }));
    // Return the component
    return (
      <div className={style.horizontal}>
        <PieChart
          data={pieChartData}
          //label={({ dataEntry }) => dataEntry.value}
          className={style.piechart}
        />
        {legendData && (
          <SimpleLegend entries={legendData} className={style.legend} />
        )}
      </div>
    )
  }, [collectionsPayload]);

  // Use the API to get MD method options
  const methodsUrl = `${BASE_PATH_PROJECTS}/options?projection=metadata.METHOD`;
  const { payload: methodsPayload, error: methodsError } = useAPI(
    methodsUrl,
  );

  // Build the collections component
  // If collections data is not yet downloaded then show a blank pie chart
  const MethodsComponent = useMemo(() => {
    // Remove the classical MD count since it would eclipse the rest of MD methods
    methodsPayload && delete methodsPayload['metadata.METHOD']['Classical MD'];
    // Set the data to be represented on the pie chart
    const methods = methodsPayload && Object.entries(methodsPayload['metadata.METHOD']);
    if (methods) methods.sort((a, b) => b[1] - a[1]);
    const colors = methods && distinctColors({ count: methods.length });
    const pieChartData = methods
      ? methods.map(([key, value], i) => ({
          title: key,
          value: value,
          color: colors[i],
        }))
      : [{ title: 'Loading...', value: 1, color: 'lightgrey' }];

    // Set the legend
    const summatory = methods && methods.reduce((current_value, [key, value]) => current_value + value, 0);
    const legendData = methods && methods.map(([key, value], i) => ({
      label: key + ' (' + (Math.round((value / summatory) * 10000 ) / 100) + ' %)',
      color: colors[i],
    }));

    // Return the component
    return (
      <div className={style.horizontal}>
        <PieChart
          data={pieChartData}
          //label={({ dataEntry }) => dataEntry.value}
          className={style.piechart}
        />
        {legendData && (
          <SimpleLegend entries={legendData} className={style.legend} />
        )}
      </div>
    )
  }, [methodsPayload]);

  // Use the API to get the snapshots options
  const snapshotsUrl = `${BASE_PATH_PROJECTS}/options?projection=metadata.SNAPSHOTS`;
  const { payload: snapshotsPayload, error: snapshotsError } = useAPI(
    snapshotsUrl,
  );

  // Build the snapshots component
  // If snapshots data is not yet downloaded then show an empty plot
  const SnapshotsComponent = useMemo(() => {
    return (
      <Histogram
        data={snapshotsPayload && snapshotsPayload["metadata.SNAPSHOTS"]}
        xAxisLabelText={'Number of snapshots'}
        yAxisLabelText={'Number of MDs'}
        onHover={d => `There are ${d.length} MDs with a number of snapshots between ${d.x0} and ${d.x1}`}
      />
    )
  }, [snapshotsPayload]);

  // Use the API to get the atoms options
  const atomsUrl = `${BASE_PATH_PROJECTS}/options?projection=metadata.SYSTATS`;
  const { payload: atomsPayload, error: atomsError } = useAPI(
    atomsUrl,
  );

  // Build the atoms component
  // If atoms data is not yet downloaded then show an empty plot
  const AtomsComponent = useMemo(() => {
    return (
      <Histogram
        data={atomsPayload && atomsPayload["metadata.SYSTATS"]}
        xAxisLabelText={'Number of atoms'}
        yAxisLabelText={'Number of MDs'}
        color={"#ffcc00"}
        onHover={d => `There are ${d.length} MDs with a number of atoms between ${d.x0} and ${d.x1}`}
      />
    )
  }, [atomsPayload]);

  // Finally build the statistics component from all subcomponents and inject it in the docs
  useMemo(() => {
    const StatisticsComponent = {
      id: 'summary',
      header: 'Data summary and statistics',
      body: (
        <>
          Here is a summary of the database contents and a few statistics:
          <br />
          <br />
          {SummaryComponent}
          <br />
          <br />
          Simulations per collection:
          {CollectionsComponent}
          Simulations per non-classical MD method:
          {MethodsComponent}
          <br />
          <br />
          Snapshots per simulation:
          {SnapshotsComponent}
          <br />
          <br />
          Atoms per simulation:
          {AtomsComponent}
        </>
      ),
    };
    // Add summary to documentation
    documentation.find(doc => doc.id === 'introduction').children = [
      ...introductionChildren,
      StatisticsComponent,
    ];
  }, [SummaryComponent, CollectionsComponent, MethodsComponent, SnapshotsComponent, AtomsComponent]);

  // Handle possible errors by just showing a log error in the console
  // Thus we allow the rest of the page to keep loading
  [summaryError, collectionsError, methodsError, snapshotsError, atomsError].forEach(error => {
    if (error) console.error(error.message);
  });
};

const Help = () => {
  useStatistics();
  // Get the location
  const location = useLocation();

  // References to all documentation blocks will be stored here
  const containerRefs = useRef();
  const docs = documentation.reduce((previous, current) => {
    previous.push(current);
    current.children && current.children.forEach(child => previous.push(child));
    return previous;
  }, []);
  const docRefs = useRef(Array(docs.length).fill(createRef()));

  // Scroll down to the asked reference
  useEffect(() => {
    const container = containerRefs.current;
    for (const ref of docRefs.current) {
      if (location.hash !== '#' + ref.id) continue;
      //window.scrollTo(0, container.offsetTop);
      container.scrollTop = ref.offsetTop - container.offsetTop;
      break;
    }
  }, [location.hash]);

  return (
    <div className={style.main}>
      <MenuList className={style.menu}>
        {documentation.map((doc, index) => (
          <details key={index} className={style.section} open>
            <summary className={style.summary}>{doc.title}</summary>
            <br className={style.space} />
            {doc.children &&
              doc.children.map((child, c) => (
                <MenuItem
                  key={c}
                  component={Link}
                  to={`/help#${child.id}`}
                  style={{ whiteSpace: 'normal' }}
                >
                  {child.header}
                </MenuItem>
              ))}
          </details>
        ))}
      </MenuList>
      <div className={style.text} ref={containerRefs}>
        {docs.map((doc, index) => (
          <div
            key={index}
            id={doc.id}
            ref={r => (docRefs.current[index] = r)}
            className={style.paragraph}
          >
            <Typography
              variant={doc.title ? 'h5' : 'h6'}
              className={style.header}
              key={'header'}
            >
              {doc.title || doc.header}
            </Typography>
            <div key={'text'}>{doc.body || doc.page}</div>
            <hr className={style.hr} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Help;
