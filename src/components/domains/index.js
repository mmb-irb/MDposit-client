import React, { useContext, useState, useMemo, Suspense } from 'react';

import Card from '../animated-card';
import { CardContent, Chip } from '@material-ui/core';

import { ProjectCtx } from '../../contexts';

import useDefaultRepresentations from '../ngl-viewer/use-default-representations';

import style from './style.module.css';

import Loading from '../loading';

import Info from '../info';

import { complexNumerationParser } from '../../utils/topology-manager';

//import useAPI from '../../hooks/use-api';

//import { BASE_PATH_TOPOREFS } from '../../utils/constants';

// Show floatting bubles with domain names
// When a bubble is selected the domain is represented
const Domains = ({ setter }) => {
  const { chains, metadata } = useContext(ProjectCtx);

  // Set the first domain (the overall) as the default selected domain
  const [selectedDomain, setSelectedDomain] = useState(0);
  /*
  // Set the API url for the toporef data
  const toporefId = metadata && metadata.TOPOREF;
  const url = `${BASE_PATH_TOPOREFS}${toporefId}/`;

  const { loading, payload, error } = useAPI(url);
  */
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
    const customDomains = metadata.DOMAINS || [];
    /*
    // Get custom domains in metadata
    const customDomains = metadata.CUSTOMS || [];
    if (payload){
      // Get domains from topology references
      const toporefDomains = payload.domains;
      // These domains are only specified for the reference sequence
      // Residue selections must be mapped back to the current topology
      const referenceDomains = [];
      toporefDomains.forEach(domain => {
        referenceDomains.push(domain);
      });
    }
    */
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
          const nglSelection = agent.residues
            .map(residue => complexNumerationParser(residue).nglSelection)
            .join(' or ');
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
    const domains = [overallDomain, ...customDomains, ...interactionDomains];
    // Reset the selected domain
    setSelectedDomain(0);
    return domains;
  }, [metadata, defaultRepresentations]);

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
