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

// Save the original introduction children
const introductionChildren = [
  ...documentation.find(doc => doc.id === 'introduction').children,
];

// Inject the summary object to the documentation
const useStatistics = () => {
  // Use the API to get the summary
  const summaryUrl = `${BASE_PATH_PROJECTS}/summary`;
  const { payload: summaryPayload, error: summaryError } = useAPI(summaryUrl);

  // Use the API to get the collections options
  const collectionsUrl = `${BASE_PATH_PROJECTS}/options?projection=metadata.COLLECTIONS`;
  const { payload: collectionsPayload, error: collectionsError } = useAPI(
    collectionsUrl,
  );

  useMemo(() => {
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
    const legendData =
      collections &&
      collections.map(([key, value], i) => ({
        label: (COLLECTION_NAMES.get(key) || key) + ' (' + value + ')',
        color: colors[i],
      }));

    // Set the summary object
    const summary = {
      id: 'summary',
      header: 'Data summary',
      body: (
        <>
          Here is a summary of the database contents:
          <br />
          <br />
          Total number of simulations:{' '}
          {summaryPayload ? summaryPayload.projectsCount : 'Loading...'}
          <br />
          Total amount of simulation time (μs):{' '}
          {summaryPayload
            ? Math.round(summaryPayload.totalTime / 1000)
            : 'Loading...'}
          <br />
          Total amount of frames:{' '}
          {summaryPayload ? summaryPayload.totalFrames : 'Loading...'}
          <br />
          Total number of stored files:{' '}
          {summaryPayload ? summaryPayload.totalFiles : 'Loading...'}
          <br />
          Total number of stored analyses:{' '}
          {summaryPayload ? summaryPayload.totalAnalyses : 'Loading...'}
          <br />
          <br />
          Simulations per collection:
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
        </>
      ),
    };

    // Add summary to documentation
    documentation.find(doc => doc.id === 'introduction').children = [
      ...introductionChildren,
      summary,
    ];
  }, [collectionsPayload, summaryPayload]);

  // Handle possible errors
  [summaryError, collectionsError].forEach(error => {
    if (!error) return;
    // In case we are having connection problems let the help page load anyway, since most of it is cached
    if (error.message === 'Network Error') return;
    // If the error is diferrent then make it obvious
    throw new Error(error.message);
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
    <div className={style.horizontal}>
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
