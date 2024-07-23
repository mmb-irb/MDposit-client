// React logic
import React, { useRef, useEffect, createRef, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';

// Visual assets
import { MenuList, MenuItem, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

// All text to be displayed is set previously here
import { documentation } from './documentation';

// Import the map chart to display where nodes are (global client only)
import NodeMap from './nodemap';

// Constants
import { BASE_PATH, BASE_PATH_PROJECTS, HOST_CONFIG } from '../../utils/constants';
// API acces
import useAPI from '../../hooks/use-api';
import useBatchAPI from 'src/hooks/use-batch-api';

import style from './style.module.css';

import { PieChart } from 'react-minimal-pie-chart';
import distinctColors from 'distinct-colors';
import SimpleLegend from '../../components/simple-legend';
import Histogram from '../../components/histogram';

// Set a function to return text within a hyperlink
const renderHref = (nodeName, nodeUrl) => <a href={nodeUrl} target="_blank" rel="noreferrer noopener">{nodeName}</a>;

// Set a function to return one symbol or another depending on a node status
const renderStatusSymbol = status => {
  if (status === 'active') return <CheckCircleIcon style={{ color: 'green', marginTop: '0.5em' }}/>;
  if (status === 'fallen') return <ErrorIcon style={{ color: 'red', marginTop: '0.5em' }}/>;
  throw new Error(`Not supported status ${status}`);
}

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
        Total number of projects:{' '}
        {summaryPayload ? summaryPayload.projectsCount : 'Loading...'}
        <br />
        Total number of MDs:{' '}
        {summaryPayload ? summaryPayload.mdCount : 'Loading...'}
        <br />
        {/*
          DANI: Funciona. Solo lo he quitado temporalmente por un tema "político"
          Total amount of MD time (μs):{' '}
          {summaryPayload ? Math.round(summaryPayload.totalTime / 1000) : 'Loading...'}
          <br />
        */}
        Total amount of MD frames:{' '}
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

  // Use the API to get the options
  const optionsUrl = `${BASE_PATH_PROJECTS}/options?projection=${HOST_CONFIG.optionsField}`;
  const { payload: optionsPayload, error: optionsError } = useAPI(optionsUrl);

  // Build the options component
  // If options data is not yet downloaded then show a blank pie chart
  const OptionsComponent = useMemo(() => {
    if (!HOST_CONFIG.optionsField) return;
    // Set the data to be represented on the pie chart
    const options = optionsPayload &&
      Object.entries(optionsPayload[HOST_CONFIG.optionsField]);
    if (options) options.sort((a, b) => b[1] - a[1]);
    const colors = options && distinctColors({ count: options.length });
    const pieChartData = options
      ? options.map(([key, value], i) => ({
          title: HOST_CONFIG.optionsNiceNames[key] || key,
          value: value,
          color: colors[i],
        }))
      : [{ title: 'Loading...', value: 1, color: 'lightgrey' }];

    // Set the legend
    const summatory = options && options.reduce((current_value, [key, value]) => current_value + value, 0);
    const legendData = options &&
      options.map(([key, value], i) => ({
        label: (HOST_CONFIG.optionsNiceNames[key] || key) + ' (' + (Math.round((value / summatory) * 10000 ) / 100) + ' %)',
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
  }, [optionsPayload]);

  // Use the API to get MD method options
  const methodsUrl = `${BASE_PATH_PROJECTS}/options?projection=metadata.METHOD`;
  const { payload: methodsPayload, error: methodsError } = useAPI(
    methodsUrl,
  );

  // Build the options component
  // If options data is not yet downloaded then show a blank pie chart
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
        {methods && methods.length > 0
        ? <PieChart
          data={pieChartData}
          //label={({ dataEntry }) => dataEntry.value}
          className={style.piechart}
        />
        : <div className={style.piechart}>
          <Typography variant="h6">No results</Typography>
        </div>}
        {legendData && (
          <SimpleLegend entries={legendData} className={style.legend} />
        )}
      </div>
    )
  }, [methodsPayload]);

  // Use the API to get the snapshots options
  const snapshotsUrl = `${BASE_PATH_PROJECTS}/options?projection=mds.frames`;
  const { payload: snapshotsPayload, error: snapshotsError } = useAPI(snapshotsUrl);

  // Use the API to get the snapshots options
  const oldSnapshotsUrl = `${BASE_PATH_PROJECTS}/options?query={"mds":{"$exists":false}}&projection=metadata.SNAPSHOTS`;
  const { payload: oldSnapshotsPayload, error: oldSnapshotsError } = useAPI(oldSnapshotsUrl);

  // Build the snapshots component
  // If snapshots data is not yet downloaded then show an empty plot
  const SnapshotsComponent = useMemo(() => {
    // Merge both the new and the old format frame counts
    const frameCounts = snapshotsPayload && oldSnapshotsPayload && { ...snapshotsPayload['mds.frames'] };
    if (snapshotsPayload && oldSnapshotsPayload) {
      Object.entries(oldSnapshotsPayload['metadata.SNAPSHOTS']).forEach(([frameCount, amount]) => {
        let currentAmount = frameCounts[frameCount] || 0;
        currentAmount += amount;
        frameCounts[frameCount] = currentAmount;
      })
    }
    return (
      <Histogram
        data={frameCounts}
        xAxisLabelText={'Number of snapshots'}
        yAxisLabelText={'Number of MDs'}
        onHover={d => `There are ${d.length} MDs with a number of snapshots between ${d.x0} and ${d.x1}`}
      />
    )
  }, [snapshotsPayload, oldSnapshotsPayload]);

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
        yAxisLabelText={'Number of projects'}
        color={"#ffcc00"}
        onHover={d => `There are ${d.length} MDs with a number of atoms between ${d.x0} and ${d.x1}`}
      />
    )
  }, [atomsPayload]);

  // Check if this is the global cliente
  const isGlobal = HOST_CONFIG.global;

  // Get nodes info
  // Use the API to get the nodes info
  const nodesUrl = isGlobal ? `${BASE_PATH}/current/nodes` : null;
  const { payload: nodesPayload, error: nodesError } = useAPI(nodesUrl);

  // Set the node map
  const NodeMapComponent = useMemo(() =>
    <NodeMap key={1} nodeData={nodesPayload} className={style.nodemap}/>,
  [nodesPayload]);

  // If this is the global client then ping all nodes to check the response time
  const pingUrls = useMemo(() => {
    if (!isGlobal || !nodesPayload) return [];
    return nodesPayload.map(node => node.api_url);
  }, [nodesPayload]);
  const pingResponses = useBatchAPI(pingUrls);

  // Set the table to be displayed including ping response times
  const NodeTableComponent = useMemo(() => {
    if (!pingResponses || pingResponses.length === 0) return;
    // Set table columns
    const columns = [
      { field: 'node', headerName: 'Node name', flex: 0.5, align: 'center', headerAlign: 'center',
        renderCell: params => renderHref(params.row.node, params.row.url) },
      { field: 'status', headerName: 'Status', flex: 0.2, align: 'center', headerAlign: 'center',
        renderCell: params => renderStatusSymbol(params.value) },
      { field: 'ping', headerName: 'Response time', flex: 0.3, align: 'center', headerAlign: 'center' }
    ];
    // Set a table row for every node
    const rows = nodesPayload.map(node => {
      const ping = pingResponses.find(response => response.url === node.api_url);
      const status = ping && ping.time ? 'active' : 'fallen';
      const responseTime = ping && ping.time ? `${ping.time}ms` : '...';
      // The 'id' field is not used but it is required by the data table
      return { id: node.alias, key: node.alias, node: node.name, url: node.api_url, status: status, ping: responseTime };
    });
    // Return the data table
    return <DataGrid columns={columns} rows={rows} disableRowSelectionOnClick hideFooter key={'node table'}/>;
  }, [nodesPayload, pingResponses]);
  

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
          {HOST_CONFIG.optionsField && <>
            {`Projects per ${HOST_CONFIG.optionsLabel}`}
            {OptionsComponent}
          </>}
          {isGlobal && [
            'Node locations',
            NodeMapComponent,
            NodeTableComponent,
            <br key={'br'}/>
          ]}
          Projects per non-equilibrium MD method:
          {MethodsComponent}
          <br />
          <br />
          Snapshots per MD:
          <br />
          <br />
          {SnapshotsComponent}
          <br />
          <br />
          System atoms per project:
          <br />
          <br />
          {AtomsComponent}
        </>
      ),
    };
    // Add summary to documentation
    const introduction = documentation.find(doc => doc.id === 'introduction');
    // In case there is a summary already, from a previous render, delete it
    if (introduction.children[introduction.children.length - 1].id === 'summary') introduction.children.pop();
    introduction.children.push(StatisticsComponent);
  }, [
    SummaryComponent,
    OptionsComponent,
    MethodsComponent,
    SnapshotsComponent,
    AtomsComponent,
    NodeMapComponent,
    NodeTableComponent
  ]);

  // Handle possible errors by just showing a log error in the console
  // Thus we allow the rest of the page to keep loading
  [summaryError, optionsError, methodsError, snapshotsError, oldSnapshotsError, atomsError, nodesError].forEach(error => {
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
