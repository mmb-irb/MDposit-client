import React, {
  Suspense,
  useContext,
  useState,
  useMemo,
  Fragment,
  useRef,
} from 'react';

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
} from '@material-ui/core';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import BondStatus from './bond-status';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx, PdbCtx, ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import {
  getAtom,
  getAtomResidue,
  absolute2standard,
  absolute2sourceResidue,
} from '../../../utils/topology-manager';

import InteractionSelector from '../../../components/interaction-selector';

import style from './style.module.css';

// Define non-changing props used by the table footer
const rowsPerPageDefault = 25;
const rowsPerPageOptions = [10, 25, 50, 100];

const Hbonds = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);
  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);
  const interactions = metadata.INTERACTIONS;

  // Set a reference to the table element so we can scroll to it
  const tableRef = useRef();

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // The newest format has 4 fields: acceptors, donors, hydrogens and hbonds
  // The hbonds includes arrays of true and false per frame
  const interaction = interactions[selectedInteraction];

  // Table pagination states
  const [selectedPage, setSelectedPage] = useState(0);
  const [selectedRowsPerPage, setSelectedRowsPerPage] = useState(
    rowsPerPageDefault,
  );

  // The hydrogen bond bar which the mouse has clicked
  const [selectedHB, setSelectedHB] = useState(null);

  // Set the API url for the heatmap data
  const url = `${BASE_PATH_PROJECTS}${accession}/analyses/hbonds/`;

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(url);

  // Set the processed data which will be displayed
  const processedData = useMemo(() => {
    // Return here if there is no payload or topology
    if (!payload || !pdbData || !pdbData.file) return;

    // Get the data whose name matches the interaction name
    // The newest format has 4 fields: acceptors, donors, hydrogens and hbonds
    // The hbonds includes arrays of true and false per frame
    const data = payload.data.find(dataset => {
      return dataset.name === interaction.name;
    });
    if (!data)
      return `Dataset for the interaction "${interaction.name}" not found`;

    // If data is empty it means no hydrogen bonds where found for this interaction
    if (data.hbonds.length === 0)
      return 'No hydrogen bonds where found for this interaction';

    // Get the number of bonds
    const bondCount = data.hbonds.length;

    // Group bonds with a common acceptor and then group bonds with a common donor
    const acceptorGroups = {};
    const donorGroups = {};
    for (let i = 0; i < bondCount; i++) {
      // Set the bond object
      const acceptor = data.acceptors[i];
      const donor = data.donors[i];
      const hydrogen = data.hydrogens[i];
      const status = data.hbonds[i];
      const bond = { acceptor, donor, hydrogen, status };
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
      return { acceptors, donors, hydrogens, status };
    });

    // Find out for each group which atoms (acceptors or donnors) belong to each interacting agent
    // Then set the labels to be displayed in the corresponding agent 1 and 2 sections in the table
    processedData.forEach(group => {
      // Find out which agent does the acceptors belong to
      const acceptorSample = group.acceptors[0];
      const residueIndex = getAtomResidue(acceptorSample, pdbData.file).index;
      const sourceResidue = absolute2sourceResidue(residueIndex, pdbData.file);
      const isAcceptorFromAgent1 =
        interaction['interface_1'].indexOf(sourceResidue.numeration) !== -1;
      group.isAcceptorFromAgent1 = isAcceptorFromAgent1;
      // Set the acceptor, donor and hydrogen labels to be displayed in the table
      const [acceptorLabels, donorLabels] = [group.acceptors, group.donors].map(
        atoms =>
          atoms.map(atom => {
            const atomName = getAtom(atom, pdbData.file).name;
            const residueIndex = getAtomResidue(atom, pdbData.file).index;
            const { label } = absolute2standard(
              residueIndex,
              pdbData.file,
              metadata,
            );
            return `${label}.${atomName}`;
          }),
      );
      const hydrogenLabels = group.hydrogens.map(atom => {
        let atomName = getAtom(atom, pdbData.file).name;
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
      // Set the group score according to the stability of all its bonds together
      // This value is then used to sort groups
      const stability = group.status.reduce(
        (acc, cur) => (acc += cur.filter(v => v === true).length),
        0,
      );
      group.stability = stability;
    });

    // Sort bond groups by status (all status added together)
    processedData.sort((a, b) => b.stability - a.stability);

    return processedData;
  }, [payload, pdbData, metadata, interaction]);

  // Set all bonds to be displayed according to the current page and the number of bonds per page
  const displayedBondGroups = useMemo(() => {
    if (!processedData) return;
    const firstBond = selectedPage * selectedRowsPerPage;
    const lastBond = (selectedPage + 1) * selectedRowsPerPage;
    return processedData.slice(firstBond, lastBond);
  }, [processedData, selectedPage, selectedRowsPerPage]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!pdbData.file) return <Loading />;

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card>
        <CardContent className={style.horizontal}>
          <Typography variant="h6">Interaction:</Typography>
          <InteractionSelector
            interactions={interactions}
            selectedInteraction={selectedInteraction}
            setSelectedInteraction={interaction => {
              setSelectedInteraction(interaction);
              setSelectedPage(0);
            }}
          />
        </CardContent>
      </Card>
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
                {/* Create a row for each project in the payload*/}
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
                            status={bondGroup.status[i]}
                            onClick={() => {
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
                            }}
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
                    onChangePage={(_, page) => {
                      setSelectedPage(page);
                      // Scroll to the top of the table
                      tableRef.current.scrollIntoView();
                    }}
                    onChangeRowsPerPage={({ target: { value } }) => {
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
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          selectedHB
            ? {
                accession: accession,
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
