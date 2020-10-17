import React, { lazy, Suspense, useState, useContext } from 'react';
import { useInView } from 'react-intersection-observer';

import {
  CardContent,
  Checkbox,
  FormControlLabel,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableFooter,
  TablePagination,
} from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';
import Info from '../../../components/info';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx, ProjectCtx, PdbCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

import {
  complexNumerationParser,
  source2modelResidue,
} from '../../../utils/topology-manager';

import Selector from '../../../components/selector';

const Graph2 = lazy(() =>
  import(/* webpackChunkName: 'graph2' */ '../../../components/graph2'),
);

const colors = ['red', 'green', 'blue', 'orange'];

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const nice = number => Math.round(number * 100) / 100;

const RmsdPerres = () => {
  // useInView acts as a React hook
  // Track if the NGL viewer (nglRef) and the analyses (nightingaleRef) are on screen
  // The status (e.g. isNglVisible) is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/rmsd-perres/`,
  );

  // Set when one point in the graph is selected
  const [selectedFrame, setSelectedFrame] = useState(null);

  // Set when one point in the graph is selected
  const [selectedResidues, setSelectedResidues] = useState([]);

  // Set when which resiudes are we meant to find
  const [searchResidues, setSearchResidues] = useState('');

  // Table management
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // The graphics to be displayed
  //const [displays, setDisplays] = useState(Array(rowsPerPage).fill(true));

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!pdbData.file || !metadata) return <Loading />;

  const data = payload.y;

  const firstKey = Object.keys(data)[0];

  const dataLength = data[firstKey].data.length;
  const xAxesStep = metadata.LENGTH / (dataLength - 1);

  // Remove the first property: 'RMSD_00001'
  if (payload.y['RMSD_00001']) delete payload.y['RMSD_00001'];

  // Parse the selection string into a numeric array
  const availableResidues = searchResidues
    ? searchResidues.split(', ')
    : Object.keys(data);

  // Now get only the selected keys from the payload
  const selectedData = { ...selectedResidues.map(residue => data[residue]) };
  // Color the first selected reisdues in the graph
  selectedResidues.forEach((residue, i) => {
    selectedData[residue] = data[residue];
    if (i < colors.length) selectedData[residue].color = colors[i];
  });

  // Count the number of residues
  const rowsNumber = availableResidues.length;

  // Set a function to get the standard model key from the topology formatted residue key
  const getLabel = residue => {
    const numeration = complexNumerationParser(residue);
    const model = source2modelResidue(numeration, pdbData.file, metadata);
    return model.tag;
  };

  // Set which options will be available in the resiude selector
  const selectorOptions = [{ label: 'All', value: '' }];
  if (metadata.INTERFACES && metadata.INTERFACES[0])
    selectorOptions.push({ label: 'Interface', value: metadata.INTERFACES[0] });

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <Info
          reference={'rmsd-perres-selector'}
          tooltip={
            <>
              This is the residues selector.
              <br />
              <br />
              Use this panel to select which residues are taken in count in the
              data table below and thus in the graph. Some default residue
              groups are provided by the authors (e.g. interface residues
              between two proteins).
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
      <Card className={style.tablecard}>
        <div className={style.paper}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {['Name', 'Mean (Å)', 'Stdev (Å)'].map(name => (
                  <TableCell key={name}>{name}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {availableResidues
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((residue, index) => {
                  const selectedIndex = selectedResidues.indexOf(residue);
                  return (
                    <TableRow key={residue}>
                      {[
                        <FormControlLabel
                          key={residue}
                          onChange={() =>
                            setSelectedResidues(previous => {
                              const newState = [...previous];
                              const index = newState.indexOf(residue);
                              if (index === -1) newState.push(residue);
                              else newState.splice(index, 1);
                              return newState;
                            })
                          }
                          control={
                            <Checkbox
                              checked={selectedIndex !== -1}
                              style={{
                                color: colors[selectedIndex] || '#000000',
                              }}
                            />
                          }
                          label={getLabel(residue)}
                        />,
                        nice(data[residue].average),
                        nice(data[residue].stddev),
                      ].map(cell => (
                        <TableCell key={cell}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  );
                })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  colSpan={3}
                  count={rowsNumber}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onChangePage={(event, newPage) => {
                    setPage(newPage);
                  }}
                  onChangeRowsPerPage={event => {
                    const newValue = event.target.value;
                    setRowsPerPage(parseInt(newValue, 10));
                    setPage(0);
                  }}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </Card>
      <Card className={style.nglcard} ref={nglRef}>
        <Info
          reference={'rmsd-perres-table'}
          tooltip={
            <>
              This data table shows the selected residues list. First column
              contains residue name, which is composed by the union of the
              residue type abbreviation (e.g. ASN, ASP, CYS...) and the topology
              numeration. Next two columns provide the RMSD mean and standard
              deviation for each residue respectively. Both measures are in
              Ångstroms.
              <br />
              <br />
              Use this data table to navigate through all selected resiudes and
              set which of them must be displayed in the graph below. To do so,
              click in the first column checkbox of the residue to be
              shown/hidden.
            </>
          }
        />
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <NGLViewerWithControls
            className={style.container}
            components={[{ frame: 0 }]}
            selectedResidues={selectedResidues}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
      <Card>
        <Graph2
          yData={selectedData}
          step={xAxesStep}
          xAxisLabel={'Time (ns)'}
          //xScaleFactor={0.001}
          yAxisLabel={'RMSd (Å)'}
          onSelect={setSelectedFrame}
          selected={selectedFrame}
          colors={colors}
        />
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          typeof selectedFrame === 'number'
            ? {
                accession: accession,
                requestedFrame: selectedFrame,
                selectedResidues: selectedResidues,
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelectedFrame(previous => {
            if (viewer.requestedFrame === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelectedFrame(previous => {
            if (viewer.requestedFrame === previous) return null;
            else return previous;
          })
        }
      />
    </Suspense>
  );
};

export default RmsdPerres;
