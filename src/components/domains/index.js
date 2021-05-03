import React, { useContext, useState, useMemo, Suspense } from 'react';

import Card from '../animated-card';
import { CardContent, Chip } from '@material-ui/core';

import { AccessionCtx, ProjectCtx, PdbCtx } from '../../contexts';

import useDefaultRepresentations from '../ngl-viewer/use-default-representations';

import style from './style.module.css';

import Loading from '../loading';

import Info from '../info';

import {
  rangedSelectionParser,
  absolute2sourceResidue,
  complexSelectionRanger,
} from '../../utils/topology-manager';

import useAPI from '../../hooks/use-api';

import { BASE_PATH_PROJECTS } from '../../utils/constants';

// Show floatting bubles with domain names
// When a bubble is selected the domain is represented
const Domains = ({ setter }) => {
  const accession = useContext(AccessionCtx);
  const { chains, metadata } = useContext(ProjectCtx);
  // Get the current topology
  const pdbData = useContext(PdbCtx);
  const topology = pdbData.file;

  // Set the first domain (the overall) as the default selected domain
  const [selectedDomain, setSelectedDomain] = useState(0);

  // Request to API the toporef data
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/toporefs`,
  );

  if (!loading && error)
    console.error('The load of topology references has failed: ' + error);

  const defaultRepresentations = useDefaultRepresentations(chains, metadata);

  // The domains strucutre is:
  // domains: [
  //    {
  //      "name" : "Example domain name",
  //      "description": "Example domain description"
  //      "representations" : [
  //        {
  //          "name" : "Region 1",
  //          "selection" : "16-316",
  //          "type": "ball+stick",
  //          "color": "element",
  //          "opacity": 0.5,
  //          ...
  //        },
  //        {
  //          "name" : "Region 2",
  //          "selection" : "418-439"
  //        }
  //      ]
  //    },
  // ]
  const domains = useMemo(() => {
    // Set the overall domain
    const overallDomain = {
      name: 'Overall',
      representations: defaultRepresentations,
    };
    // Get custom domains in metadata
    const customDomains = metadata.CUSTOMS || [];
    // Get domains from topology references
    const referenceDomains = [];
    const toporefs = metadata.TOPOREFS;
    if (payload && toporefs) {
      // DANI: Esto hay que rehacerlo cuando haya más de un toporef -----------------------------
      const firstAndUniqueToporef = payload[0];
      const toporefName = firstAndUniqueToporef.name;
      const toporefDomains = firstAndUniqueToporef.domains;
      const metadataToporef = toporefs.find(
        toporef => toporef.name === toporefName,
      );
      const metadataToporefMap = metadataToporef.map;
      // ----------------------------------------------------------------------------------------
      // These domains are only specified for the reference sequence
      // Residue selections must be mapped back to the current topology for each representation
      toporefDomains.forEach(domain => {
        const mappedDomain = {
          name: domain.name,
          description: domain.description,
          representations: [],
        };
        domain.representations.forEach(representation => {
          const selection = representation.selection;
          const parsedSelection = rangedSelectionParser(selection);
          // WARNING: A single reference residue may correspond to multiple topology residues
          const mappedSelection = [].concat.apply(
            [],
            parsedSelection.map(residue =>
              metadataToporefMap.reduce((a, res, r) => {
                // We substract 1 since the reference numeration is from 1 to n and we want it from 0
                if (res === residue) a.push(r);
                return a;
              }, []),
            ),
          );
          // Representations with a selection not present in topology are discarded
          if (mappedSelection.length === 0) return;
          // Transform the mapped selection, which comes in absolute numeration, to the source format
          // The source numeration is compatible with NGL once parsed
          const sourceSelection = mappedSelection.map(
            residue => absolute2sourceResidue(residue, topology).numeration,
          );
          const { rangedSelection, small } = complexSelectionRanger(
            sourceSelection,
          );
          const newRepresentation = { ...representation };
          newRepresentation.selection = rangedSelection;
          // parsedSelectionRanger returns 'small' = true when there are series of 3 residues or less
          // These small residue selections will be not represented in cartoon due to an NGL bug
          // https://github.com/nglviewer/ngl/issues/223
          if (small) newRepresentation.type = 'licorice';
          mappedDomain.representations.push(newRepresentation);
        });
        // Domains whose representatios have been all discarded are also discarded
        if (mappedDomain.representations.length > 0)
          referenceDomains.push(mappedDomain);
      });
    }
    // Get domains constructed from interactions
    const interactionDomains = [];
    if (metadata.INTERACTIONS)
      metadata.INTERACTIONS.forEach(interaction => {
        // Add a new domain for each new agent and skip repeated agents
        const agent1 = {
          name: interaction.agent_1,
          residues: interaction.residues_1,
        };
        const agent2 = {
          name: interaction.agent_2,
          residues: interaction.residues_2,
        };
        [agent1, agent2].forEach(agent => {
          const current = interactionDomains.find(domain => {
            return domain.name === agent.name;
          });
          if (current) return;
          const { rangedSelection: nglSelection } = complexSelectionRanger(
            agent.residues,
          );
          interactionDomains.push({
            name: agent.name,
            representations: [
              {
                name: agent.name,
                selection: nglSelection,
                type: 'licorice',
              },
            ],
          });
        });
      });
    const domains = [
      overallDomain,
      ...customDomains,
      ...referenceDomains,
      ...interactionDomains,
    ];
    // Reset the selected domain
    setSelectedDomain(0);
    return domains;
  }, [metadata, defaultRepresentations, payload, topology]);

  useMemo(() => {
    if (!domains) return {};
    const currentDomain = domains[selectedDomain];
    // Set an NGL representation for each domain representation
    const representations = currentDomain.representations.map(rep => {
      return {
        name: rep.name,
        selection: rep.selection,
        show: rep.show,
        type: rep.type,
        color: rep.color,
        opacity: rep.opacity,
      };
    });
    // Add a representation with the whole strucutre in grey color and with the opacity reduced
    if (currentDomain.name !== 'Overall')
      representations.push({
        name: 'Reference',
        color: 'grey',
        opacity: 0.1,
      });

    // Set the NGL selection for the focus
    const focusSelection =
      '(' +
      currentDomain.representations.map(rep => rep.selection).join(') or (') +
      ')';
    const initialFocus = { comp: 0, sele: focusSelection };
    setter({ representations, initialFocus });
  }, [domains, selectedDomain, setter]);

  return (
    <Suspense fallback={<Loading />}>
      {domains && domains.length > 0 && (
        <Card className={style.card}>
          <Info
            reference={'domain-selection'}
            tooltip={
              <>
                Suggested interesting domains
                <br />
                <br />
                Click any domain to highlight it in the NGL viewer.
              </>
            }
          />
          <CardContent>
            {'Domains: '}
            {domains.map((dom, d) => (
              <Chip
                key={dom.name}
                title={dom.description}
                className={style.chips}
                label={dom.name}
                variant={selectedDomain === d ? undefined : 'outlined'}
                color={selectedDomain === d ? 'primary' : undefined}
                onClick={() =>
                  setSelectedDomain(previous => {
                    if (previous === d) return 0;
                    return d;
                  })
                }
              />
            ))}
          </CardContent>
        </Card>
      )}
    </Suspense>
  );
};

export default Domains;
