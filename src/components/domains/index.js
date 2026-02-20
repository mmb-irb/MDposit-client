import React, {
  useContext,
  useState,
  useMemo,
  useEffect,
  Suspense,
} from 'react';

import Card from '../animated-card';
import { CardContent, Chip } from '@mui/material';

import { ProjectCtx } from '../../contexts';

import style from './style.module.css';

import Loading from '../loading';

import { rangedSelectionParser, sameValues } from '../../utils/auxiliar-functions';
// Get the defaults representations getter
import getDefaultRepresentations from '../../utils/topology-manager/get-default-reprensetations';

// Show floatting bubles with domain names
// When a bubble is selected the domain is represented
const Domains = ({ setRepresentations, setInitialFocus }) => {
  // Get the current project data
  const {
    metadata,
    proteinReferences,
    ligandReferences,
    topology,
    interactions
  } = useContext(ProjectCtx);

  // Set the first domain (the overall) as the default selected domain
  const [selectedDomain, setSelectedDomain] = useState(0);
  const [overlapedDomain, setOverlapedDomain] = useState(null);

  // Get pre-build representations
  const defaultRepresentations = topology && topology.defaultRepresentations;
  const mutationsRepresentation = topology && topology.mutationsRepresentations;
  const epitopesRepresentation = topology && topology.epitopesRepresentations;

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
    if (!topology) return;
    // Set the overall domain
    const overallDomain = {
      name: 'Overall',
      representations: defaultRepresentations,
    };
    // Get custom domains in metadata
    const customDomains = metadata.CUSTOMS || [];
    // Get domains constructed from interactions
    const interactionDomains = [];
    if (interactions) {
      interactions.forEach(interaction => {
        if (interaction.failed) return;
        // Add a new domain for each new agent and skip repeated agents
        const agent1 = {
          name: interaction.agent_1,
          atoms: interaction.atom_indices_1,
        };
        const agent2 = {
          name: interaction.agent_2,
          atoms: interaction.atom_indices_2,
        };
        [agent1, agent2].forEach(agent => {
          const current = interactionDomains.find(domain => domain.name === agent.name);
          if (current) return;
          const nglSelection = topology.atomIndices2Ngl(agent.atoms);
          interactionDomains.push({
            name: `Interacting agent "${agent.name}"`,
            description: 'This is one of the interacting agents considered in interaction analyses.',
            representations: [
              {
                name: agent.name,
                selection: nglSelection,
                type: 'licorice',
                color: 'element',
              },
            ],
          });
        });
      });
    }
    // Get domains from protein references
    // Skip those whose name matches with an interacting agent or custom domain
    const referenceDomains = [];
    proteinReferences && proteinReferences.forEach(proteinReference => {
      const referenceId = proteinReference.uniprot;
      // Start by creating a domain for the whole reference
      const wholeReferenceResidueIndices = topology.getReferenceResidueIndices(referenceId);
      if (!wholeReferenceResidueIndices || wholeReferenceResidueIndices.length === 0) return;
      const wholeReferenceRepresentations = getDefaultRepresentations(topology, wholeReferenceResidueIndices);
      const wholeReferenceDomain = {
        name: proteinReference.name,
        description: `UniProt ${referenceId} reference.`,
        representations: wholeReferenceRepresentations,
      };
      referenceDomains.push(wholeReferenceDomain);
      // Collect all domains in protein reference data
      let referenceDataDomains = [];
      // Domains in the 'domains' filed are automatically mined from uniprot
      if (proteinReference.domains) referenceDataDomains = referenceDataDomains.concat(proteinReference.domains);
      // Domains in the 'custom_domains' filed are added by hand in the database and they are not common
      if (proteinReference.custom_domains) referenceDataDomains = referenceDataDomains.concat(proteinReference.custom_domains);
      // If there are not domains at all then stop here
      if (referenceDataDomains.length === 0) return;
      // ----------------------------------------------------------------------------------------
      // These domains are only specified for the protein reference sequence
      // Residue selections must be mapped back to the current topology for each domain
      // Custom reference domains may contain a 'representations' field instead of a 'selection' field
      referenceDataDomains.forEach(domain => {
        const domainName = domain.name;
        // Discard the domain if its name matches an already existing domain
        if (customDomains.find(domain => domain.name === domainName)) return;
        if (interactionDomains.find(domain => domain.name === domainName))
          return;
        // Discard the domain if its name matches the reference name
        // This is quite usual: some references have domains which are basically the whole thing
        // There may be a small difference in both ends, but it is redundant anyway
        // Note that we already added a domain for the whole reference
        // Sometimes the domain with the whole thing has a slightly different name
        // So we may also discard it later if the selection is identical
        if (proteinReference.name === domainName) return;
        // Set the text to be displayed on hover
        let description = domain.description;
        // Let the user know that this domain comes from UniProt
        // It may not have description
        if (description) description += ` This domain was obtained from UniProt ${referenceId}.`;
        else description = `This domain was obtained from UniProt ${referenceId}.`;
        // Set the final domain
        const mappedDomain = {
          name: proteinReference.name + ' - ' + domainName,
          description: description,
          representations: [],
        };
        // If we have a selection (the usual case) then parse it and set default representations for it
        if (domain.selection) {
          const parsedSelection = rangedSelectionParser(domain.selection);
          const domianResidueIndices = topology.getReferenceResidueIndices(referenceId, parsedSelection);
          // If residue indices in this domain are identical to residue indices in the whole reference
          // then skip this domain. This is quite common.
          if (!sameValues(domianResidueIndices, wholeReferenceResidueIndices)) {
            // Add the representations for this specific region to the domain
            const domainRepresentations = getDefaultRepresentations(topology, domianResidueIndices);
            mappedDomain.representations.push(...domainRepresentations);
          }
        }
        // If we have a custom set of representations (unusual) then parse these representations
        // Parse the selections to proper NGL selections
        // In some cases the type may be overriden to licorice (small ranges or coarse grain)
        if (domain.representations) {
          domain.representations.forEach(representation => {
            const selection = representation.selection;
            const parsedSelection = rangedSelectionParser(selection);
            // WARNING: A single protein reference residue may correspond to multiple topology residues
            const mappedSelection = topology.getReferenceResidueIndices(referenceId, parsedSelection);
            // Representations with a selection not present in topology are discarded
            if (!mappedSelection || mappedSelection.length === 0) return;
            // Transform the residue indices to a NGL selection
            const { rangedSelection: nglSelection, small } = topology.residueIndices2Ngl(mappedSelection);
            const newRepresentation = { ...representation };
            newRepresentation.selection = nglSelection;
            // residueIndices2Ngl returns 'small' = true when there are series of 3 residues or less
            // These small residue selections will be not represented in cartoon due to an NGL bug
            // https://github.com/nglviewer/ngl/issues/223
            if (small) newRepresentation.type = 'licorice';
            // Check if any residue is in coarse grain
            // If so then the cartool will also fail
            // We will also need to set the licorice type of representation
            const cgResidue = mappedSelection.find(residueIndex => topology.getResidueByIndex(residueIndex).isCg);
            if (cgResidue) newRepresentation.type = 'licorice';
            mappedDomain.representations.push(newRepresentation);
          });
        }
        // Domains whose representatios have been all discarded are also discarded
        if (mappedDomain.representations.length > 0)
          referenceDomains.push(mappedDomain);
      });
    });
    // Create a new domains for every ligand reference
    // Skip those whose name matches with an interacting agent or custom domain
    ligandReferences && ligandReferences.forEach(ligandReference => {
      // Set the ligand name as the domain name
      const domainName = ligandReference.name;
      // Discard the domain if its name matches an already existing custom domain
      if (customDomains.find(domain => domain.name === domainName)) return;
      // Get the NGL selection for ligand residues
      // Ligands are identified by their InChIKey or PubChem ID (old system)
      const referenceId = ligandReference.inchiRef.inchikey;
      const residueIndices = topology.getReferenceResidueIndices(referenceId)
      if (!residueIndices || residueIndices.length === 0) {
        console.error(`Ligand reference "${ligandReference.pubchem}" not found in topology`);
        return;
      }
      const ligandRepresentations = getDefaultRepresentations(topology, residueIndices);
      // Set the ligand domain
      const ligandDomain = {
        name: domainName,
        representations: ligandRepresentations,
      };
      // Add it to the reference domains list
      referenceDomains.push(ligandDomain);
    });
    // Put all domains together
    const domains = [
      overallDomain,
      ...customDomains,
      ...referenceDomains,
      ...interactionDomains,
    ];
    // Add the mutations domain if possible
    if (mutationsRepresentation) {
      const mutationsDomain = {
        name: 'Mutations',
        description:
          'Show the entropies of each residue according to the bibliography',
        representations: mutationsRepresentation,
      };
      domains.push(mutationsDomain);
    }
    // Add the epitopes domain if possible
    if (epitopesRepresentation) {
      const epitopesDomain = {
        name: 'Epitopes',
        description:
          'Show regions considered as epitopes according to the bibliography',
        representations: epitopesRepresentation,
      };
      domains.push(epitopesDomain);
    }
    // Reset the selected domain
    setSelectedDomain(0);
    return domains;
  }, [
    metadata,
    defaultRepresentations,
    mutationsRepresentation,
    epitopesRepresentation,
    topology,
    proteinReferences,
    interactions,
  ]);

  // Add the selected domain (if any) configuration to the viewer
  useEffect(() => {
    if (!domains) return;
    const currentSelectedDomain = domains[selectedDomain];
    const currentSelectedRepresentations = currentSelectedDomain.representations.map(
      rep => {
        return { ...rep };
      },
    );
    const currentOverlapedDomain =
      overlapedDomain !== null && domains[overlapedDomain];
    const currentOverlapedRepresentations = currentOverlapedDomain
      ? currentOverlapedDomain.representations.map(rep => {
          return {
            ...rep,
            type: 'spacefill',
            opacity: rep.opacity ? rep.opacity * 0.2 : 0.2,
          };
        })
      : [];
    // Set an NGL representation for each domain representation
    const representations = [
      ...currentSelectedRepresentations,
      ...currentOverlapedRepresentations,
    ];
    // Add a representation with the whole strucutre in grey color and with the opacity reduced
    if (currentSelectedDomain.name !== 'Overall')
      representations.push({
        name: 'Reference',
        color: 'grey',
        opacity: 0.2,
      });

    // Set the NGL selection for the focus
    const focusSelection = `(${
      currentSelectedDomain.representations
        .map(rep => rep.selection)
        .join(') or (')
    })`;
    const initialFocus = { sele: focusSelection };
    setRepresentations(representations);
    setInitialFocus(initialFocus);
  }, [domains, selectedDomain, overlapedDomain, setRepresentations, setInitialFocus]);

  // If project data is still loading then stop here
  if (!domains) return <Loading />;

  return (
    <Suspense fallback={<Loading />}>
      {domains && domains.length > 0 && (
        <Card className={style.card}>
          <CardContent>
            <a className={style.title}>Domains</a>
            {domains.map((dom, d) => (
              <Chip
                key={d}
                title={dom.description}
                className={style.chips}
                label={dom.name}
                variant={
                  selectedDomain === d || overlapedDomain === d
                    ? undefined
                    : 'outlined'
                }
                color={
                  selectedDomain === d
                    ? 'primary'
                    : overlapedDomain === d
                    ? 'secondary'
                    : undefined
                }
                onClick={event => {
                  // When the keys control, shift or command (ios) are hold while clicking
                  const overlap =
                    event.shiftKey || event.ctrlKey || event.metaKey;
                  if (overlap)
                    return setOverlapedDomain(previous => {
                      if (previous === d) return null;
                      if (selectedDomain === d) return null;
                      return d;
                    });
                  else
                    return setSelectedDomain(previous => {
                      if (previous === d) return 0;
                      if (overlapedDomain === d) setOverlapedDomain(null);
                      return d;
                    });
                }}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </Suspense>
  );
};

export default Domains;
