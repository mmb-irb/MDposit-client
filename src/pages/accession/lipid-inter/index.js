import React, { lazy, Suspense, useState, useContext, useMemo, useRef, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

import {
  CardContent,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  FormControlLabel,
  Checkbox,
  Tabs,
  Tab,
  Typography,
  Slider,
} from '@mui/material';

import Card from '../../../components/animated-card';
import ViewerWithControls from '../../../components/viewer-with-controls';
import Loading from '../../../components/loading';
import ColorLegend from '../../../components/color-legend';

import useAPI from '../../../hooks/use-api';
import { ProjectCtx } from '../../../contexts';
import { BASE_PATH_PROJECTS } from '../../../utils/constants';
import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';

import style from './style.module.css';
import { ColormakerRegistry } from 'ngl';

const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const LipidInteractions = () => {
  const { accessionAndMdNumber, metadata, chains  } = useContext(ProjectCtx);
  const [nglRef, isNglVisible] = useInView(useInViewOptions);
  const viewerRef = useRef(null);

  // Get the default representations
  const defaultRepresentations = useDefaultRepresentations();

  // Send a request to the API with the url of the specific analysis
  const {
    loading: interactionsLoading,
    payload: interactionsPayload,
    error: interactionsError,
  } = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/lipid-inter/`);

  // Get the membrane map
  const {
    loading: memMapLoading,
    payload: memMapPayload,
    error: memMapError,
  } = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/mem-map/`);

  // Add state for selected lipid type
  const [selectedLipid, setSelectedLipid] = useState(null);
  const [representations, setRepresentations] = useState(null);
  const schemes = useRef({});

  // Get available lipid types for tabs
  const lipidTypes = useMemo(() => {
    if (!interactionsPayload || !interactionsPayload.data) return [];
    return Object.keys(interactionsPayload.data);
  }, [interactionsPayload]);

  // Set initial selected lipid when data loads
  useMemo(() => {
    if (lipidTypes.length && !selectedLipid) {
      setSelectedLipid(lipidTypes[0]);
    }
  }, [lipidTypes, selectedLipid]);

  // Generate a color scheme based on interaction data
  const generateScheme = (lipidType) => {
    if (!interactionsPayload || !interactionsPayload.data || !lipidType) return null;
    const max = Math.max(...interactionsPayload.data[lipidType]);
    return ColormakerRegistry.addScheme(function (params) {
      this.atomColor = function (atom) {
        if (!atom.residueIndex) return 0xcccccc; // Default color if no residue index
        const residueID = atom.residueIndex;
        const interactionData = interactionsPayload.data[lipidType];
        // Check if this residue has interaction data
        if (interactionData && residueID < interactionData.length) {
          const value = interactionData[residueID];
          // If below threshold, make it grey
          if (value < 0) {
            return 0xcccccc;
          }
            // Create a gradient from white (0xffffff) to dark red (0x800000) through orange
            // For white -> orange -> dark red transition
            const normalized = value/max;
            let red = 255;
            let green, blue;
            
            if (normalized < 0.5) {
            // White to orange transition (first half)
            green = 255 - Math.floor(128 * normalized * 2); // Gradually reduce green
            blue = 255 - Math.floor(255 * normalized * 2);  // Rapidly reduce blue
            } else {
            // Orange to dark red transition (second half)
            green = 127 - Math.floor(127 * (normalized - 0.5) * 2); // Continue reducing green
            blue = 0; // Blue stays at zero
            }
            
            // Combine into RGB color
            return (red << 16) | (green << 8) | blue;
        }
        
        return 0xcccccc; // Default color
      };
    });
  };

  // Get or create a scheme for a lipid type
  const getSchemeForLipid = (lipidType) => {
    if (!schemes.current[lipidType]) {
      schemes.current[lipidType] = generateScheme(lipidType);
    }
    return schemes.current[lipidType];
  };

  // Update representations when selection changes
  useEffect(() => {
    if (!defaultRepresentations || defaultRepresentations.length === 0 || !selectedLipid) return;
    
    const customScheme = getSchemeForLipid(selectedLipid);
    defaultRepresentations.forEach(rep => {

        if (chains.indexOf(rep.selection.slice(1,2)) !== -1) {
            rep.color = 'custom';
            rep.type = 'spacefill';
            rep.customScheme = customScheme;
        } else if (rep.name === 'Membrane') {
            rep.color = 'orange';
            rep.opacity = 0.0;
        }
        
    });
    const lipidRep = {
      'name': selectedLipid,
      'type': 'licorice',
      'color': 'orange',
      'opacity': 0.3,
      'selection': `( ${selectedLipid} )`,
    };

    setRepresentations([...defaultRepresentations, lipidRep]);
  }, [selectedLipid, defaultRepresentations, memMapPayload]);

  if (interactionsLoading || memMapLoading) return <Loading />;
  if (interactionsError) return interactionsError.toString();
  if (memMapError) return memMapError.toString();
  if (!interactionsPayload || !memMapPayload) return 'Something bad happened with Lipid Interactions analysis';

  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <CardContent>
          <Tabs
            value={selectedLipid}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
            onChange={(event, value) => {
              setSelectedLipid(value);
            }}
            className={style.tabs}
          >
            {lipidTypes.map((lipid) => (
              <Tab
                key={lipid}
                value={lipid}
                label={
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span>
                      {memMapPayload?.references?.[lipid]?.resname || lipid}
                    </span>
                    {/* <Typography variant="caption" color="text.secondary">
                      {memMapPayload?.references?.[lipid]?.lipidmaps?.name || 'Lipid'}
                    </Typography> */}
                  </div>
                }
              />
            ))}
          </Tabs>
          
          {/* <div className={style.controls}>
            <Typography id="threshold-slider" gutterBottom>
              Interaction Threshold: {threshold}
            </Typography>
            <Slider
              value={threshold}
              onChange={(e, newValue) => setThreshold(newValue)}
              aria-labelledby="threshold-slider"
              step={0.05}
              marks
              min={0}
              max={1}
              valueLabelDisplay="auto"
            />
            
          </div> */}
        </CardContent>
      </Card>
      
      {/* <Card className={style.legend_container}>
        <ColorLegend
          title={'Lipid Interaction Frequency'}
          minValue={0}
          maxValue={1}
          colorPlan={colorPalette}
          vertical={true}
          className={style.legend}
        />
      </Card> */}
      
      <Card className={style.nglcard} ref={nglRef}>
        {isNglVisible ? (
          <ViewerWithControls
            className={style.container}
            representationsState={[representations, setRepresentations]}
            ref={viewerRef}
            rotateX={true}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </Suspense>
  );
};

export default LipidInteractions;
