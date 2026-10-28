import React, { lazy, Suspense, useState, useContext, useMemo, useRef, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

import {
  CardContent,
  Tabs,
  Tab,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';

import Card from '../../../components/animated-card';
import ViewerWithControls from '../../../components/viewer-with-controls';
import Loading from '../../../components/loading';
import ColorLegend from '../../../components/color-legend';

import useAPI from '../../../hooks/use-api';
import { ProjectCtx } from '../../../contexts';
import { BASE_PATH_PROJECTS } from '../../../utils/constants';
import { getLipidNames, getReferenceResidueNames } from '../../../utils/lipids';

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

  // Add state for selected lipid type and lipid part (head / tail)
  const [selectedLipid, setSelectedLipid] = useState(null);
  const [selectedPart, setSelectedPart] = useState('head');
  const [representations, setRepresentations] = useState(null);
  const schemes = useRef({});

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
  }, [lipidTypes, selectedLipid]);

  // Get the names and synonyms from the references
  const lipidNames = useMemo(() => {
    if (!lipidTypes.length || !inchikeyReferences) return {};
    return lipidTypes.reduce((acc, lipid) => {
      // Check if lipid is an inchikey (exists in inchikeyReferences)
      const inchiKey = inchikeyReferences.find(ref => ref.inchikey === lipid);
      const residueNames = inchiKey && getReferenceResidueNames(topology, lipid);
      acc[lipid] = getLipidNames(lipid, inchiKey, residueNames);
      return acc;
    }, {});
  }, [lipidTypes, inchikeyReferences, topology]);

  // Get the lipid residue selection for the SpawnViewer
    const lipidSelection = useMemo(() => {
      if (!lipidTypes.length || !topology) return {};
      return lipidTypes.reduce((acc, lipid) => {
        let resIndices;
        let atomsSelection;
        // Check if lipid is an inchikey (exists in inchikeyReferences)
        const isInchikey = inchikeyReferences && inchikeyReferences.some(ref => ref.inchikey === lipid);
        if (isInchikey) {
          resIndices = topology.getReferenceResidueIndices(lipid);
          atomsSelection = `( @${topology.residue2atomIndices(resIndices).join(',')} )`;
        } else {
          // Use lipid name for selection
          atomsSelection = `( ${lipid} )`;
        }
        acc[lipid] = atomsSelection;
        return acc;
      }, {});
    }, [lipidTypes, topology]);

  // Detect whether a lipid entry uses the new {head, tail} format or the old flat array
  // Can be delete after all analysis have version >= 0.1.0
  const isNewFormat = (lipid) =>
    interactionsPayload &&
    interactionsPayload.data &&
    lipid &&
    !Array.isArray(interactionsPayload.data[lipid]);

  // Generate a color scheme based on interaction data for a given lipid and part
  const generateScheme = (lipid, part) => {
    if (!interactionsPayload || !interactionsPayload.data || !lipid) return null;
    return ColormakerRegistry.addScheme(function (params) {
      this.atomColor = function (atom) {
        // Check if this residue has interaction data
        const resIdx = interactionsPayload.data.residue_indices.indexOf(atom.residueIndex);
        if (resIdx === -1) return 0xffffff;
        // Support both old flat array format and new {head, tail} format
        const lipidData = interactionsPayload.data[lipid];
        const value = Array.isArray(lipidData) ? lipidData[resIdx] : lipidData[part][resIdx];
        // Create a gradient from white (0xffffff) to dark red (0x800000) through orange
        // For white -> orange -> dark red transition (value is already a probability in [0, 1])
        const normalized = Math.sqrt(value);
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
    }, `${lipid}_${part}`);
  };

  // Get or create a scheme for a lipid type and part combination
  const getSchemeForLipid = (lipidType, part) => {
    const key = `${lipidType}_${part}`;
    if (!schemes.current[key]) {
      schemes.current[key] = generateScheme(lipidType, part);
    }
    return schemes.current[key];
  };
  
  // Update representations when lipid or part selection changes
  useEffect(() => {
    if (!defaultRepresentations || defaultRepresentations.length === 0 || !selectedLipid) return;
    defaultRepresentations.forEach(rep => {
        if (rep.name.toLowerCase().includes('protein')) { 
            rep.color = 'custom';
            rep.type = 'spacefill';
            rep.color = getSchemeForLipid(selectedLipid, selectedPart);
            rep.customScheme = `${selectedLipid}_${selectedPart}`;
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
  }, [selectedLipid, selectedPart, defaultRepresentations]);

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
          
          <div className={style.part_toggle} style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
            {/* Only show head/tail toggle when the selected lipid uses the new format */}
            {isNewFormat(selectedLipid) && (
              <ToggleButtonGroup
                value={selectedPart}
                exclusive
                onChange={(event, value) => { if (value) setSelectedPart(value); }}
                size="small"
              >
                <ToggleButton value="head">Head group</ToggleButton>
                <ToggleButton value="tail">Tails</ToggleButton>
              </ToggleButtonGroup>
            )}
          </div>
        </CardContent>
      </Card>
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
