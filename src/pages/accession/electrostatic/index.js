import React, { useContext, useMemo, useState, useRef, useEffect } from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

import Card from '../../../components/animated-card';
import { CardContent, Typography } from '@material-ui/core';

import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';

import style from './style.module.css';

//import { AccessionCtx } from '../../../contexts';
import { ProjectCtx, PdbCtx } from '../../../contexts';

import Loading from '../../../components/loading';

import InteractionSelector from '../../../components/interaction-selector';

import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';

import { complexNumerationParser } from '../../../utils/topology-manager';

import { ColormakerRegistry } from 'ngl';
import { color as d3color, scaleLinear } from 'd3';

//import { BASE_PATH_PROJECTS } from '../../../utils/constants';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

// Set the color of each residue in the NGL representation
// WARNING: Grey looks better than white because the background may be white and resdiues are hard to see
// Red goes for negative charges and blue goes for positive charges
const chargesColorPlan = ['red', 'white', 'blue'];

const Electrostatic = () => {
  // Track if the NGL viewer
  // The status isNglVisible is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Set a ref to the ngl which allows access to the ngl viewer exposed methods
  const viewerRef = useRef(null);

  // Get the accession
  //const accession = useContext(AccessionCtx);
  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);
  // Get the current topology
  const pdbData = useContext(PdbCtx);

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // This is a toggle state for which interface is the 'surfaced' and which is the 'sticked'
  const [selectedOrder, setSelectedOrder] = useState(true);

  // Get the default representations
  const defaultRepresentations = useDefaultRepresentations();

  // Set the representations for the NGL viewer
  const { representations, initialFocus } = useMemo(() => {
    if (!metadata || !pdbData.file) return {};
    // In case there are charges us them create a color scale to pain the surface area
    const charges = metadata.CHARGES;
    let colorScheme;
    if (charges) {
      // Set the color scale according to the maximum and minimum values
      const colorScale = scaleLinear()
        .range(chargesColorPlan)
        .domain([-1, 0, +1]);
      // Set the colorScheme to get each value corresponding color
      colorScheme = ColormakerRegistry.addScheme(function(params) {
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
    }

    // Proceed to make representations for the current interaction
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
      color: colorScheme ? 'custom' : 'electrostatic',
      customScheme: colorScheme,
    };

    // Set the sticked representation
    const stickedInterface = nglInterface2;
    const stickedRepresentation = {
      name: interaction.agent_2 + ' interface',
      selection: stickedInterface.join(' or '),
      type: 'ball+stick',
      color: 'element',
      customScheme: colorScheme,
    };

    // Make the default representations transparent
    defaultRepresentations.forEach(rep => {
      rep.customScheme = colorScheme;
      rep.opacity = 0.1;
    });

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
  }, [metadata, pdbData, defaultRepresentations, selectedInteraction]);

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
    // Check if current representations have a custom color scheme
    // If so, set the color as 'custom' instead of 'electrostatic'
    const color = representations[interface1Index].customScheme
      ? 'custom'
      : 'electrostatic';
    viewerRef.current.setColoringMethods(previous => {
      previous[interface1Index] = selectedOrder ? color : 'element';
      previous[interface2Index] = selectedOrder ? 'element' : color;
      return [...previous];
    });
  }, [representations, selectedOrder]);

  if (!metadata || !pdbData.file) return <Loading />;

  const handleToggleOrder = () => {
    setSelectedOrder(previous => !previous);
  };

  return (
    <>
      <Card>
        <CardContent className={style.horizontal}>
          <Typography variant="h6">Interaction:</Typography>
          <InteractionSelector
            interactions={metadata.INTERACTIONS}
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
