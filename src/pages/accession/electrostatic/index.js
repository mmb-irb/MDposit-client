import React, { useContext, useMemo } from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

import Card from '../../../components/animated-card';
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';

import style from './style.module.css';

//import { AccessionCtx } from '../../../contexts';
import { ProjectCtx, PdbCtx } from '../../../contexts';

import Info from '../../../components/info';
import Loading from '../../../components/loading';

import {
  complexNumerationParser,
  getMetadataChainname,
} from '../../../utils/topology-manager';

//import { BASE_PATH_PROJECTS } from '../../../utils/constants';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const Electrostatic = () => {
  // useInView acts as a React hook
  // Track if the NGL viewer (nglRef) and the analyses (nightingaleRef) are on screen
  // The status (e.g. isNglVisible) is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the accession
  //const accession = useContext(AccessionCtx);
  // Get the current project chains
  const { metadata, chains } = useContext(ProjectCtx);
  // Get the current topology
  const pdbData = useContext(PdbCtx);

  // Set the chains to be represented in the NGL viewer
  const [nglChains, selectedLigands] = useMemo(() => {
    if (!chains || !metadata || !pdbData.file) return;

    const chainsNGL = [];
    // Represent all protein chains in cartoon
    for (const c of chains) {
      chainsNGL.push({
        name:
          'Chain ' +
          c +
          ' (' +
          getMetadataChainname(c, metadata, pdbData.file) +
          ')',
        selection: ':' + c,
        defaultDrawingMethod: 'cartoon',
      });
    }

    // Get the interface selection string
    const interfaceSelection = metadata.INTERFACES[0];

    // Set the NGL selection for each chain interface
    const nglInterfaceSelections = [];
    interfaceSelection.split(', ').forEach(res => {
      const {
        chain,
        nglSelection,
        nglChainSelection,
      } = complexNumerationParser(res);
      // Exclude ligands. We don't want their surfaces to be represented
      if (metadata.LIGANDS)
        for (const lig of metadata.LIGANDS)
          if (lig.ngl_selection === nglChainSelection) return;
      // If the chain is already in the interfaces selection list we expand the selection
      for (const sel of nglInterfaceSelections)
        if (sel.chain === chain) {
          sel.selection += ' or ' + nglSelection;
          return;
        }
      // If not, we add a new interface selection
      nglInterfaceSelections.push({ chain: chain, selection: nglSelection });
    });

    // Those chains with residues in the interface show their mentioned residues
    // This representation is in electrostatic surface
    for (const selection of nglInterfaceSelections) {
      chainsNGL.push({
        name:
          'Chain ' +
          selection.chain +
          ' (' +
          getMetadataChainname(selection.chain, metadata, pdbData.file) +
          ') interface',
        selection: selection.selection,
        //defaultDrawingMethod: 'licorice',
        defaultDrawingMethod: 'surface',
        defaultColoringMethod: 'electrostatic',
      });
    }

    // Select ligands to be highlighted, so the camera will focus on them
    const ligandsNGL = metadata.LIGANDS ? [] : undefined;
    if (metadata.LIGANDS) {
      for (const ligand of metadata.LIGANDS) {
        ligandsNGL.push(ligand.ngl_selection);
      }
    }

    return [chainsNGL, ligandsNGL];
  }, [chains, metadata, pdbData]);

  if (!metadata || !pdbData.file) return <Loading />;

  return (
    <>
      <Card className={style.card} ref={nglRef}>
        <Info
          reference={'electrostatic'}
          tooltip={
            <>
              This is the electrostatic potencial surface representation.
              <br />
              <br />
              The{' '}
              <a
                href="http://nglviewer.org/"
                target="_blank"
                rel="noreferrer noopener"
              >
                NGL viewer
              </a>{' '}
              represents the main structures and the interface surfaces between
              two interacting proteins. Surfaces are painted according the
              electrostatic potencial.
              <br />
              <br />
              Trajectory is not loaded in this context because the surface
              representation is too heavy to be updated dinamically.
            </>
          }
        />
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <NGLViewerWithControls
            className={style.container}
            representations={nglChains}
            requestedFrame={1}
            selectedCustom={selectedLigands}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </>
  );
};

export default Electrostatic;
