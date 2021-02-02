import React, { useContext, useMemo, useState, useRef, useEffect } from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

import Card from '../../../components/animated-card';
import { CardContent, Typography } from '@material-ui/core';

import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';

import style from './style.module.css';

//import { AccessionCtx } from '../../../contexts';
import { ProjectCtx, PdbCtx } from '../../../contexts';

import Info from '../../../components/info';
import Loading from '../../../components/loading';

import InteractionSelector from '../../../components/interaction-selector';

import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';

import { complexNumerationParser } from '../../../utils/topology-manager';

//import { BASE_PATH_PROJECTS } from '../../../utils/constants';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const Electrostatic = () => {
  // Track if the NGL viewer
  // The status isNglVisible is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Set a ref to the ngl which allows access to the ngl viewer exposed methods
  const viewerRef = useRef(null);

  // Get the accession
  //const accession = useContext(AccessionCtx);
  // Get the current project chains
  const { metadata, chains } = useContext(ProjectCtx);
  // Get the current topology
  const pdbData = useContext(PdbCtx);

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // This is a toggle state for which interface is the 'surfaced' and which is the 'sticked'
  const [selectedOrder, setSelectedOrder] = useState(true);

  // Get the default representations
  const defaultRepresentations = useDefaultRepresentations(chains, metadata);

  // Set the representations for the NGL viewer
  const { representations, initialFocus } = useMemo(() => {
    if (!chains || !metadata || !pdbData.file) return;

    const interaction = metadata.INTERACTIONS[selectedInteraction];

    // Parse the interface selections to the NGL format
    const [nglInterface1, nglInterface2] = [
      interaction.interface_1,
      interaction.interface_2,
    ].map(interf =>
      interf.map(res => complexNumerationParser(res).nglSelection),
    );

    // Create a new representation for each interface
    // By default the interface 1 is the surfaced and the interface 2 is the sticked

    // Set the surfaced representation
    const surfacedInterface = nglInterface1;
    const surfacedRepresentation = {
      name: interaction.agent_1 + ' interface',
      selection: surfacedInterface.join(' or '),
      type: 'surface',
      color: 'electrostatic',
    };

    // Set the sticked representation
    const stickedInterface = nglInterface2;
    const stickedRepresentation = {
      name: interaction.agent_2 + ' interface',
      selection: stickedInterface.join(' or '),
      type: 'ball+stick',
      color: 'element',
    };

    // Make the default representations transparent
    defaultRepresentations.forEach(rep => (rep.opacity = 0.1));

    // Join all representations
    const representations = [
      ...defaultRepresentations,
      surfacedRepresentation,
      stickedRepresentation,
    ];

    // Set the focus to the whole interface
    const wholeInterface = [...surfacedInterface, ...stickedInterface];
    const initialFocus = { comp: 0, sele: wholeInterface.join(' or ') };

    return { representations, initialFocus };
  }, [chains, metadata, pdbData, defaultRepresentations, selectedInteraction]);

  // Update representations type and color when the selected order changes
  useEffect(() => {
    if (!viewerRef.current) return;
    // Interface representations are the 2 last representations
    const interface1Index = representations.length - 2;
    const interface2Index = representations.length - 1;
    viewerRef.current.setDrawingMethods(previous => {
      previous[interface1Index] = selectedOrder ? 'surface' : 'ball+stick';
      previous[interface2Index] = selectedOrder ? 'ball+stick' : 'surface';
      return [...previous];
    });
    viewerRef.current.setColoringMethods(previous => {
      previous[interface1Index] = selectedOrder ? 'electrostatic' : 'element';
      previous[interface2Index] = selectedOrder ? 'element' : 'electrostatic';
      return [...previous];
    });
  }, [representations, selectedOrder]);

  if (!metadata || !pdbData.file) return <Loading />;

  return (
    <>
      <Card>
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
        <CardContent className={style.horizontal}>
          <Typography variant="h6">Interaction:</Typography>
          <InteractionSelector
            interactions={metadata.INTERACTIONS}
            selectedInteraction={selectedInteraction}
            setSelectedInteraction={setSelectedInteraction}
            selectedOrder={selectedOrder}
            setSelectedOrder={setSelectedOrder}
          />
        </CardContent>
      </Card>
      <Card className={style.card} ref={nglRef}>
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <NGLViewerWithControls
            className={style.container}
            representations={representations}
            requestedFrame={1}
            initialFocus={initialFocus}
            ref={viewerRef}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </>
  );
};

export default Electrostatic;
