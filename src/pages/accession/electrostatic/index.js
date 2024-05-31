import React, { useContext, useMemo, useState } from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

import Card from '../../../components/animated-card';
import { CardContent, Typography } from '@mui/material';

import ViewerWithControls from '../../../components/ngl-viewer-with-controls';

import style from './style.module.css';

import { ProjectCtx } from '../../../contexts';

import Loading from '../../../components/loading';

import InteractionSelector from '../../../components/interaction-selector';

import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';

import { ColormakerRegistry } from 'ngl';
import { color as d3color, scaleLinear } from 'd3';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

// Set the color of each residue in the NGL representation
// WARNING: Grey looks better than white because the background may be white and resdiues are hard to see
// Red goes for negative charges and blue goes for positive charges
const CHARGES_COLOR_PLAN = ['red', 'white', 'blue'];

// Set references to find representations between different renders
const FIRST_AGENT_REF = 'first agent';
const SECOND_AGENT_REF = 'second agent';

const Electrostatic = () => {
  // Track if the NGL viewer
  // The status isNglVisible is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the current project data
  const { topology, interactions } = useContext(ProjectCtx);

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // This is a toggle state for which interface is the 'surfaced' and which is the 'sticked'
  const [selectedOrder, setSelectedOrder] = useState(true);

  // Define the representations to be displayed in the viewer
  const [ representations, setRepresentations ] = useState(null);

  // Get the default representations
  const defaultRepresentations = useDefaultRepresentations();

  // In case there are charges, use them to create a color scale to pain the surface area
  const chargesColorScheme = useMemo(() => {
    if (!topology) return;
    // Get charges from topology
    const charges = topology.atomCharges;
    if (!charges) return;
    // Set the color scale according to the maximum and minimum values
    const colorScale = scaleLinear()
      .range(CHARGES_COLOR_PLAN)
      .domain([-1, 0, +1]);
    // Set the colorScheme to get each value corresponding color
    return ColormakerRegistry.addScheme(function(params) {
      this.atomColor = atom => {
        // Get the atom charge
        const charge = charges[atom.index];
        // Calculate the interpolated rgb for this value
        // The interpolated color comes in rbg format
        const hexColor = d3color(colorScale(charge)).formatHex();
        // The color interpolation returns a string like '#000000'
        // We remove the first character ('#') and parse it to integer from hexadecimal
        const color = parseInt(hexColor.substring(1), 16);
        return color;
      };
    });
  }, [topology]);

  // Set the representations according to the selected interaction
  // Set also the viewer focus
  const initialFocus = useMemo(() => {
    if (!topology || !interactions) return;
    // Proceed to make representations for the current interaction
    const interaction = interactions && interactions[selectedInteraction];
    if (!interaction) return;

    // Parse the interface selections to the NGL format
    const [nglInterface1, nglInterface2] = [
      interaction.interface_indices_1,
      interaction.interface_indices_2,
    ].map(interf => topology.residueIndices2Ngl(interf).rangedSelection);

    // Set representation parameters for both the surfaced and the sticked interfaces
    const surfacedParameters = {
      type: 'surface',
      color: chargesColorScheme ? 'custom' : 'electrostatic',
      customScheme: chargesColorScheme
    };
    const stickedParameters = {
      type: 'ball+stick',
      color: 'element',
    };

    // Update the representations state
    setRepresentations(previousRepresentations => {
      // If this is the first render then set the representation with some default values
      if (previousRepresentations === null) {
        // Make the default representations transparent
        defaultRepresentations.forEach(rep => {
          rep.customScheme = chargesColorScheme;
          rep.opacity = 0.1;
        });
        // Create a new representation for each interface
        // Set the surfaced representation
        const firstAgentInterface = {
          name: interaction.agent_1 + ' interface',
          selection: nglInterface1,
          reference: FIRST_AGENT_REF,
          ...(selectedOrder ? surfacedParameters : stickedParameters),
        };
        // Set the sticked representation
        const secondAgentInterface = {
          name: interaction.agent_2 + ' interface',
          selection: nglInterface2,
          reference: SECOND_AGENT_REF,
          ...(selectedOrder ? stickedParameters : surfacedParameters),
        };
        // Join all representations and update the state
        return [
          ...defaultRepresentations,
          firstAgentInterface,
          secondAgentInterface,
        ];
      }
      // If this is not the first render then update old representations
      // Make no change to default or custom (added by the user) representations
      // Only update the sticked and surface representations
      const firstAgentInterface = previousRepresentations.find(rep => rep.reference === FIRST_AGENT_REF);
      firstAgentInterface.name = interaction.agent_1 + ' interface';
      firstAgentInterface.selection = nglInterface1;
      Object.assign(firstAgentInterface, selectedOrder ? surfacedParameters : stickedParameters);
      const secondAgentInterface = previousRepresentations.find(rep => rep.reference === SECOND_AGENT_REF);
      secondAgentInterface.name = interaction.agent_2 + ' interface';
      secondAgentInterface.selection = nglInterface2;
      Object.assign(secondAgentInterface, selectedOrder ? stickedParameters : surfacedParameters);
      // Update the state
      return [...previousRepresentations];
    });

    // Set the focus to the whole interface
    const wholeInterface = `(${nglInterface1} or ${nglInterface2})`;
    const initialFocus = { comp: 0, sele: wholeInterface };
    return initialFocus;
  }, [
    topology,
    chargesColorScheme,
    interactions,
    defaultRepresentations,
    selectedInteraction,
    selectedOrder
  ]);

  // If data is loaded but there are no interactions
  if (!interactions || interactions.length === 0)
  return 'There are no interactions';

  if (!topology || !interactions) return <Loading />;

  const handleToggleOrder = () => {
    setSelectedOrder(previous => !previous);
  };

  return (
    <>
      <Card>
        <CardContent className={style.horizontal}>
          <Typography variant="h6">Interaction:</Typography>
          <InteractionSelector
            interactions={interactions}
            selectedInteraction={selectedInteraction}
            setSelectedInteraction={setSelectedInteraction}
            selectedOrder={selectedOrder}
            handleToggleOrder={handleToggleOrder}
            firstOrderLabel={'Surfaced interface'}
            firstOrderTooltip={
              'Interface residues to be represented in electorstatic surface mode'
            }
            secondOrderLabel={'Sticked interface'}
            secondOrderTooltip={
              'Interface residues to be represented in balls and sticks mode'
            }
            toggleOrderTooltip={'Toggle interface representations'}
          />
        </CardContent>
      </Card>
      <Card className={style.card} ref={nglRef}>
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <ViewerWithControls
            className={style.container}
            representationsState={[ representations, setRepresentations ]}
            requestedFrame={1}
            initialFocus={initialFocus}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </>
  );
};

export default Electrostatic;
