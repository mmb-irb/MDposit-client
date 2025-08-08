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

import style from './style.module.css';
import { ColormakerRegistry } from 'ngl';

const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const LipidInteractions = () => {
  const { accessionAndMdNumber, topology, inchikeyReferences } = useContext(ProjectCtx);
  const [nglRef, isNglVisible] = useInView(useInViewOptions);
  const viewerRef = useRef(null);

  // Get the default representations
  const defaultRepresentations = topology && topology.defaultRepresentations;

  // Send a request to the API with the url of the specific analysis
  const {
    loading: interactionsLoading,
    payload: interactionsPayload,
    error: interactionsError,
  } = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/lipid-inter/`);

  // Add state for selected lipid type
  const [selectedLipid, setSelectedLipid] = useState(null);
  const [representations, setRepresentations] = useState(null);
  const schemes = useRef({});
  const maxOccupancy = useRef({});

  // Get available lipid types for tabs
  const lipidTypes = useMemo(() => {
    if (!interactionsPayload || !interactionsPayload.data) return [];
    
    // Get available lipid types for tabs
    return Object.keys(interactionsPayload.data).filter(key => key !== 'residue_indices');
  }, [interactionsPayload]);
  
  // Set initial selected lipid when data loads
  useMemo(() => {
    if (lipidTypes.length && !selectedLipid) {
      setSelectedLipid(lipidTypes[0]);
    }
    // Save max occupancy of all lipids in a ref
    maxOccupancy.current = lipidTypes.reduce((acc, lipid) => {
      acc[lipid] = Math.max(...interactionsPayload.data[lipid]);
      return acc;
    }, {});
    maxOccupancy.current = Math.max(...Object.values(maxOccupancy.current));
  }, [lipidTypes, selectedLipid]);

  // Get the names and synonyms from the references
  const lipidNames = useMemo(() => {
    if (!lipidTypes.length || !inchikeyReferences) return {};
    return lipidTypes.reduce((acc, lipid) => {
      const ref = inchikeyReferences.find(ref => ref.inchikey === lipid);
      let name, shortName, longName;
      if (ref.lipidmaps.synonyms) {
        name = ref.lipidmaps.name;
        shortName = ref.lipidmaps.synonyms.split('; ').sort((a, b) => a.length - b.length)[0];
        longName = ref.lipidmaps.sys_name;
      } else if (ref.swisslipids.synonyms) {
        name = shortName = ref.swisslipids.synonyms.find(item => item.type === 'abbreviation').name;
        longName = ref.swisslipids.entity_name;
      }
      console.log('lipid', lipid, 'name', name, 'shortName', shortName, 'longName', longName);
      acc[lipid] = { name, shortName, longName };
      return acc;
    }, {});
  }, [lipidTypes, inchikeyReferences]);

  // Get the lipid residue selection for the SpawnViewer
    const lipidSelection = useMemo(() => {
      if (!lipidTypes.length || !topology) return {};
      return lipidTypes.reduce((acc, lipid) => {
        const resIndices = topology.getReferenceResidueIndices(lipid);
        const atomsSelection = `( @${topology.residue2atomIndices(resIndices).join(',')} )`;
        acc[lipid] = atomsSelection;
        return acc;
      }, {});
    }, [lipidTypes, topology]);

  // Generate a color scheme based on interaction data
  const generateScheme = (lipid) => {
    if (!interactionsPayload || !interactionsPayload.data || !lipid) return null;
    return ColormakerRegistry.addScheme(function (params) {
      this.atomColor = function (atom) {
        // Check if this residue has interaction data
        const resIdx = interactionsPayload.data.residue_indices.indexOf(atom.residueIndex);
        if (resIdx === -1) return 0xffffff;
        const value = interactionsPayload.data[lipid][resIdx];
        // Create a gradient from white (0xffffff) to dark red (0x800000) through orange
        // For white -> orange -> dark red transition
        const normalized = Math.sqrt(value/maxOccupancy.current);
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
        };
    }, lipid);
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
    defaultRepresentations.forEach(rep => {
        if (rep.name.toLowerCase().includes('protein')) { 
            rep.color = 'custom';
            rep.type = 'spacefill';
            rep.color = getSchemeForLipid(selectedLipid);
            rep.customScheme = selectedLipid;
        } else if (rep.name.toLowerCase().includes('lipid')) {
            rep.color = 'grey';
            rep.opacity = 0.1;
        }
    });
    const lipidRep = {
      'name': selectedLipid,
      'type': 'licorice',
      'color': 'orange',
      'opacity': 0.3,
      'selection': lipidSelection[selectedLipid],
    };

    setRepresentations([...defaultRepresentations, lipidRep]);
  }, [selectedLipid, defaultRepresentations]);

  if (interactionsLoading) return <Loading />;
  if (interactionsError) return interactionsError.toString();
  if (!interactionsPayload) return 'Something bad happened with Lipid Interactions analysis';

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
              lipidNames[lipid] && <Tab
                key={lipid}
                value={lipid}
                label={
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span title={`${lipidNames[lipid].longName}`}>
                      {lipidNames[lipid].name}
                    </span>
                    {lipidNames[lipid].shortName !== lipidNames[lipid].name && (
                      <Typography variant="caption" color="text.secondary" title={`${lipidNames[lipid].longName}`}>
                        {lipidNames[lipid].shortName}
                      </Typography>
                    )}
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
