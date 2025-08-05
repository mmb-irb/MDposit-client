import React, {
  Suspense,
  useContext,
  useState,
  useMemo,
  Fragment,
  useRef,
  useCallback,
} from 'react';
// Import material UI components
import {
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  TableFooter,
  Typography,
} from '@mui/material';
// Import custom components
import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import ViewerSpawner from '../../../components/viewer-spawner';
import InteractionSelector from '../../../components/interaction-selector';
import BondStatus from './bond-status';
// Import our custom hooks
import useAPI from '../../../hooks/use-api';
import useRemfo from 'src/hooks/use-remfo';
// Import the project context
import { ProjectCtx } from '../../../contexts';
// Import some constants
import { BASE_PATH_PROJECTS } from '../../../utils/constants';
// Import CSS style
import style from './style.module.css';
// Import auxiliar functions
import { add, max } from 'src/utils/auxiliar-functions';
import Version from 'src/utils/version';

// Set the minimum hydrogen bond stability peak to filter which hydrogen bonds are shown
const STABILITY_CUTOFF = 0.05;

// Define non-changing props used by the table footer
const rowsPerPageDefault = 25;
const rowsPerPageOptions = [10, 25, 50, 100];

const Hbonds = () => {
  // Get the current project data
  const {
    accessionAndMdNumber,
    metadata,
    topology,
    interactions,
    populations,
  } = useContext(ProjectCtx);

  // Set a reference to the table element so we can scroll to it
  const tableRef = useRef();

  // Send a request to the API with the url of the hbonds analyses index
  const analysesUrlBase = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses`;
  const indexUrl = `${analysesUrlBase}/hbonds`;
  const { loading: indexLoading, payload: indexPayload, error: indexError } = useAPI(indexUrl);

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // The newest format has 4 fields: acceptors, donors, hydrogens and hbonds
  // The hbonds includes arrays of true and false per frame
  const interaction = interactions && interactions[selectedInteraction];

  // Set the target interaction name
  const { interactionName, analysisName } = useMemo(() => {
    // Wait for main data to be downloaded
    if (!interaction || !indexPayload) return {};
    // Check if the analysis is in the old or the new format
    const isOld = indexPayload.data !== undefined;
    // If so, there is no target analysis name, but the whole data is already in the payload
    if (isOld) return { interactionName: interaction.name };
    const targetEntry = indexPayload.find(entry => entry.name === interaction.name);
    return { interactionName: interaction.name, analysisName: targetEntry.analysis }
  }, [interaction, indexPayload]);

  // Send a request to the API with the url of some specific hbonds analysis
  const interactionAnalysisUrl = analysisName ? `${analysesUrlBase}/${analysisName}` : null;
  const { loading, payload, error } = useAPI(interactionAnalysisUrl);

  // Now set the actual dataset to be used
  // Note that this is a compatibility layer between the old and the new hbonds system
  const dataset = useRemfo(previous => {
    // Wait for the download to finish
    if (!indexPayload) return previous;
    // Check if the analysis is in the old or the new format
    const isOld = indexPayload.data !== undefined;
    // If this is the new system then the dataset is the payload itself
    if (!isOld) {
      if (!payload) return previous;
      return payload;
    }
    // If this is the old system then the dataset is in the index payload
    const interactionData = indexPayload.data.find(entry => entry.name === interactionName);
    if (!interactionData) return { error: `Dataset for interaction "${interactionName}" not found` };
    return interactionData;
  }, [indexPayload, payload, interactionName]);

  // Set the processed data which will be displayed
  const { processedData, weights } = useMemo(() => {
    // Return here if we are still waiting for data
    if (!dataset || !topology || !metadata) return {};
    if (populations && populations.loading) return {};

    // If the dataset is empty it means no hydrogen bonds where found for this interaction
    if (dataset.hbonds.length === 0) return {
      message: 'No hydrogen bonds were found for this interaction'
    };

    // Get the version of the analysis
    const version = new Version(dataset.version);
    let hbondsKey = 'hbonds_timed';
    // If the simulation is not time related then there will be no timed hbonds
    // We will use the overall hbonds instead
    const noTimeRelated = metadata.TYPE === 'ensemble';
    if (noTimeRelated) hbondsKey = 'hbonds';
    // In the old version the timed hbonds were in a different key
    if (version.major < 1) hbondsKey = 'hbonds';

    // Get the number of bonds
    const bondCount = dataset.hbonds.length;

    // Group bonds with a common acceptor and then group bonds with a common donor
    const acceptorGroups = {};
    const donorGroups = {};
    for (let i = 0; i < bondCount; i++) {
      // Set the bond object
      const acceptor = dataset.acceptors[i];
      const donor = dataset.donors[i];
      const hydrogen = dataset.hydrogens[i];
      let status = dataset[hbondsKey][i];
      // Note that status will be a single float if this is an enseble
      // We make sure it is an array to keep the types coherent
      if (!Array.isArray(status)) status = [status];
      // Find the maximum stability
      // Use this value to filter which hydrogen bonds are shown
      const maxStability = max(status);
      if (maxStability < STABILITY_CUTOFF) continue;
      // Define also the stability of the hydrogen bond by adding its status over time
      // This value is then used to sort groups
      const stability = add(status) / status.length;
      const bond = { acceptor, donor, hydrogen, status, stability };
      // Add current bond to its corresponding acceptor group
      const acceptorGroup = acceptorGroups[acceptor];
      if (acceptorGroup) acceptorGroup.push(bond);
      else acceptorGroups[acceptor] = [bond];
      // Add current bond to its corresponding donor group
      const donorGroup = donorGroups[donor];
      if (donorGroup) donorGroup.push(bond);
      else donorGroups[donor] = [bond];
    }

    // Join all groups together discarding redundant groups
    const groups = [];
    const commons = [];
    // Join unique acceptor groups
    // Unique acceptor groups are those which have bonds with more than one different donor
    Object.values(acceptorGroups).forEach(group => {
      const donors = group.map(bond => bond.donor);
      const uniqueDonors = new Set(donors);
      if (uniqueDonors.size > 1) groups.push(group);
      // Otherwise, add the group to the common groups list
      else commons.push(group);
    });
    // Join unique donor groups
    // Unique donor groups are those which have bonds with more than one different acceptor
    Object.values(donorGroups).forEach(group => {
      const acceptors = group.map(bond => bond.acceptor);
      const uniqueAcceptors = new Set(acceptors);
      if (uniqueAcceptors.size > 1) groups.push(group);
      // WARNING: There is no need to add common groups to the list now
      // They can only be repeater or redundant
      // Repeated ones will be already in the list
      // Redundant ones are discardes so we are not intereseted
    });
    // Common groups are thouse who have both an unique acceptor and an unique donor
    // They will always be repeated or redundant (already included in bigger groups)
    // If they are redundant then we are done
    // Otherwise it means they are repeated so we only have to add it once to the list
    commons.forEach(group => {
      // Check if one of its bonds is included in any group already
      const bondSample = group[0];
      for (const group of groups) {
        for (const bond of group) {
          // In case the acceptor (or the donnor) matches is enought to discard the whole group
          if (bond.acceptor === bondSample.acceptor) return;
        }
      }
      // In case no coincidence was found we include the bond
      groups.push(group);
    });

    // Sum up the groups in the list of atoms and status
    // When all acceptors/donors/hydrogens are the same atom leave an unique value in the list
    const processedData = groups.map(group => {
      let acceptors = group.map(bond => bond.acceptor);
      const uniqueAcceptors = new Set(acceptors);
      if (uniqueAcceptors.size === 1) acceptors = [acceptors[0]];
      let donors = group.map(bond => bond.donor);
      const uniqueDonors = new Set(donors);
      if (uniqueDonors.size === 1) donors = [donors[0]];
      let hydrogens = group.map(bond => bond.hydrogen);
      const uniqueHydrogens = new Set(hydrogens);
      if (uniqueHydrogens.size === 1) hydrogens = [hydrogens[0]];
      const status = group.map(bond => bond.status);
      // Set the group stability score adding the stability of their individual bonds
      // This value is then used to sort groups
      const stability = add(group.map(bond => bond.stability));
      return { acceptors, donors, hydrogens, status, stability };
    });

    // Find out for each group which atoms (acceptors or donnors) belong to each interacting agent
    // Then set the labels to be displayed in the corresponding agent 1 and 2 sections in the table
    processedData.forEach(group => {
      // Find out which agent does the acceptors belong to
      const acceptorIndex = group.acceptors[0];
      const acceptorAtom = topology.getAtomByIndex(acceptorIndex);
      const isAcceptorFromAgent1 =
        interaction['interface_atom_indices_1'].indexOf(acceptorAtom.index) !== -1;
      group.isAcceptorFromAgent1 = isAcceptorFromAgent1;
      // Set the acceptor, donor and hydrogen labels to be displayed in the table
      const [acceptorLabels, donorLabels] = [group.acceptors, group.donors].map(
        atoms =>
          atoms.map(atomIndex => {
            const atom = topology.getAtomByIndex(atomIndex);
            return `${atom.residue.standardLabel}.${atom.name}`;
          }),
      );
      const hydrogenLabels = group.hydrogens.map(atomIndex => {
        const atom = topology.getAtomByIndex(atomIndex);
        let atomName = atom.name;
        if (isAcceptorFromAgent1) atomName = atomName + ' —';
        else atomName = '— ' + atomName;
        return atomName;
      });
      group.hydrogenLabels = hydrogenLabels;
      // Now set the agent 1 and 2 labels
      if (isAcceptorFromAgent1) {
        group.agent1Labels = acceptorLabels;
        group.agent2Labels = donorLabels;
      } else {
        group.agent1Labels = donorLabels;
        group.agent2Labels = acceptorLabels;
      }
    });

    // Sort bond groups by status (all status added together)
    processedData.sort((a, b) => b.stability - a.stability);

    // Calculate the frame step for recorded hydrogen bonds
    const dataLength = dataset.hbonds[0].length;
    const frameStep = Math.round(metadata.mdFrames / (dataLength - 1));
    // Set the weigths in order to resize bonds bandwidth accordingly
    // Note that this is for the old verion, in the new version values are already weighted
    let weights;
    if (populations && populations.payload && version.major < 1) {
      // Get the weights for each data value corresponding frame
      weights = [];
      for (let i = 0; i < populations.payload.length; i += frameStep) {
        weights.push(populations.payload[i]);
      }
      // Check weights and data to match in the number of values
      const weigthCount = weights.length;
      if (dataLength !== weigthCount) throw new Error(
        `Data values count (${dataLength}) does not match the weigths values count (${weigthCount})`,
      );
    }
    return { processedData, weights };
  }, [dataset, metadata, topology, interaction, populations]);

  // Table pagination states
  const [selectedPage, setSelectedPage] = useState(0);
  const [selectedRowsPerPage, setSelectedRowsPerPage] = useState(
    rowsPerPageDefault,
  );

  // Set all bonds to be displayed according to the current page and the number of bonds per page
  const displayedBondGroups = useMemo(() => {
    if (!processedData) return;
    const firstBond = selectedPage * selectedRowsPerPage;
    const lastBond = (selectedPage + 1) * selectedRowsPerPage;
    return processedData.slice(firstBond, lastBond);
  }, [processedData, selectedPage, selectedRowsPerPage]);

  // The hydrogen bond bar which the mouse has clicked
  const [selectedHB, setSelectedHB] = useState(null);

  // Handle when the user clicks in a bond status
  const handleBondClick = useCallback(keyLabel => {
    const [b,i] = keyLabel.split('-');
    const bondGroup = displayedBondGroups[b];
    const acceptor =
      bondGroup.acceptors[i] ||
      bondGroup.acceptors[0];
    const donor =
      bondGroup.donors[i] || bondGroup.donors[0];
    const hydrogen =
      bondGroup.hydrogens[i] ||
      bondGroup.hydrogens[0];
    setSelectedHB({
      selectedAtoms: [acceptor, donor],
      selectedDistances: [[acceptor, donor]],
      selectedAngles: [[acceptor, hydrogen, donor]],
    });
  }, [displayedBondGroups]);

  // Handle when the user selects a different interaction
  const handleChangeInteraction = useCallback(interaction => {
    setSelectedInteraction(interaction);
    setSelectedPage(0);
  }, []);

  // Render loading or error messages according with the API response
  if (indexError) return indexError.toString();
  if (error) return error.toString();
  if (dataset && dataset.error) return dataset.error;
  if (populations && populations.error) return populations.error.toString();
  if (!dataset) {
    if (indexLoading || loading) return <Loading />;
    // If there are no interactions or topology
    if (!interactions) return 'There are no interactions';
    if (!topology) return 'There is no topology';
    return 'Something bad happened with the analysis data';
  }
  if (populations && !populations.payload) {
    if (populations.loading) return <Loading />;
    return 'Something bad happened with populations data';
  }

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card>
        <CardContent className={style.horizontal}>
          <Typography variant="h6">Interaction:</Typography>
          <InteractionSelector
            interactions={interactions}
            selectedInteraction={selectedInteraction}
            setSelectedInteraction={handleChangeInteraction}
          />
        </CardContent>
      </Card>
      <div className={indexLoading || loading ? style.disabled : style.enabled}>
        {typeof processedData === 'string' && (
          <Card>
            <CardContent>
              <Typography variant="h6">{processedData}</Typography>
            </CardContent>
          </Card>
        )}
        {typeof processedData === 'object' && (
          <Card className={style.margined}>
            <CardContent>
              <Table ref={tableRef}>
                {/* Setting column widths explicitly is important for the bond status chart to adapt its width */}
                <colgroup>
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '64%' }} />
                </colgroup>
                <TableHead className={style['table-head']}>
                  <TableRow>
                    <TableCell>{interaction.agent_1}</TableCell>
                    <TableCell>Hydrogen</TableCell>
                    <TableCell>{interaction.agent_2}</TableCell>
                    <TableCell>Bond status along trajectory</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Create a row for each bond to be displayed*/}
                  {displayedBondGroups.map((bondGroup, b) => (
                    <Fragment key={b}>
                      {bondGroup.status.map((status, i) => (
                        <TableRow key={i}>
                          {/* agent 1 atom/s */}
                          {bondGroup.agent1Labels[i] && (
                            <TableCell
                              rowSpan={
                                bondGroup.status.length /
                                bondGroup.agent1Labels.length
                              }
                            >
                              {bondGroup.agent1Labels[i]}
                            </TableCell>
                          )}
                          {/* hydrogen */}
                          {bondGroup.hydrogenLabels[i] && (
                            <TableCell
                              rowSpan={
                                bondGroup.status.length /
                                bondGroup.hydrogenLabels.length
                              }
                              align={
                                bondGroup.isAcceptorFromAgent1 ? 'right' : 'left'
                              }
                            >
                              {bondGroup.hydrogenLabels[i]}
                            </TableCell>
                          )}
                          {/* agent 2 atom */}
                          {bondGroup.agent2Labels[i] && (
                            <TableCell
                              rowSpan={
                                bondGroup.status.length /
                                bondGroup.agent2Labels.length
                              }
                            >
                              {bondGroup.agent2Labels[i]}
                            </TableCell>
                          )}
                          {/* bond status */}
                          <TableCell>
                            <BondStatus
                              status={status}
                              weights={weights}
                              // Bond group and bond index are passed to further know which bond it is
                              // Thus the on click function already has dis data as input argument
                              keyLabel={`${b}-${i}`}
                              onClick={handleBondClick}
                              className={style.status}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TablePagination
                      rowsPerPageOptions={rowsPerPageOptions} // Optional numbers of rows displayed in each page. It can be modified by the user.
                      colSpan={4} // Set the anchor of columns which is taken as a reference for the horizontal position of the footer
                      count={processedData.length} // Total number of rows
                      rowsPerPage={selectedRowsPerPage} // The actual number of rows displayed
                      page={selectedPage} // The actual page
                      onPageChange={(_, page) => {
                        setSelectedPage(page);
                        // Scroll to the top of the table
                        tableRef.current.scrollIntoView();
                      }}
                      onRowsPerPageChange={({ target: { value } }) => {
                        setSelectedRowsPerPage(value);
                        setSelectedPage(0);
                      }}
                    />
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
      <ViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          selectedHB
            ? {
                selectedAtoms: selectedHB.selectedAtoms,
                selectedDistances: selectedHB.selectedDistances,
                selectedAngles: selectedHB.selectedAngles,
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelectedHB(previous => {
            if (previous && previous.selectedAtoms === viewer.selectedAtoms)
              return null;
            else return previous;
          })
        }
        onClose={viewer => {
          setSelectedHB(previous => {
            if (previous && previous.selectedAtoms === viewer.selectedAtoms)
              return null;
            else return previous;
          });
        }}
      />
    </Suspense>
  );
};

export default Hbonds;
