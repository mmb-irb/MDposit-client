import { useContext, useMemo } from 'react';

import { ProjectCtx } from '../../../contexts';
import useBatchAPI from '../../../hooks/use-batch-api';
import { BASE_PATH_PROJECTS } from '../../../utils/constants';
import {
  DYNAMIC_BOX,
  getPbcContactsWarning,
  getContactImages,
} from '../../../utils/pbc-contacts';

// Color of the periodic images, so they are not confused with the system itself
export const IMAGE_COLOR = 'lightsteelblue';
// Color of the residues in contact
// Note that the default color of carbohydrates is purple, so avoid similar colors (e.g. magenta)
export const CONTACT_COLOR = 'orange';

// Box vectors per frame: 3 vectors of 3 float32 coordinates
const BOX_COORDINATES = 9;

const MAIN_COMPONENT = 'Main';

// Representation types which would hide the residues in contact
const HIDING_TYPES = new Set(['spacefill', 'surface']);

// Remove the residues in contact from the default representations which would hide them
// Lipid representations are kept as they are, since the reduced membrane view finds them by their selection
// Note that lipids are in PBC, so they are never in contact anyway
const uncoverContacts = (representations, contactSelection) => representations.map(representation => {
  if (!HIDING_TYPES.has(representation.type)) return representation;
  if (representation.name.toLowerCase().includes('lipid')) return representation;
  return { ...representation, selection: `(${representation.selection}) and not (${contactSelection})` };
});

// Set the viewer components and representations to show contacts across periodic boundaries
// The frame with most contacts is shown together with the two periodic images which contact the system
// Residues in contact are highlighted both in the system and in its images
// The camera focuses on the contact between the system (selection A) and the forward image (selection B)
// Return null while the simulation box is loading
const usePbcContactsView = () => {
  const { metadata, topology, accessionAndMdNumber } = useContext(ProjectCtx);

  const warning = getPbcContactsWarning(metadata);
  if (!warning) throw new Error('There are no contacts across periodic boundaries in this simulation');
  if (!metadata.BOX) throw new Error('The simulation box is missing so periodic images can not be shown');
  if (!Number.isInteger(warning.frame))
    throw new Error(`Unexpected frame in the PBC contacts warning: ${warning.frame}`);
  const frame = warning.frame;

  // If the box changes along the trajectory then download the box of the contacts frame
  // Note that the frames range in the API is 1-based
  const isDynamicBox = metadata.BOX === DYNAMIC_BOX;
  // WARNING: The URLs array must be memoized, since useBatchAPI requests again every time it changes
  const boxUrls = useMemo(() => isDynamicBox
    ? [`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/trajectory/box?frames=${frame + 1}`]
    : [], [isDynamicBox, accessionAndMdNumber, frame]);
  const boxResponses = useBatchAPI(boxUrls);

  const boxVectors = useMemo(() => {
    if (!isDynamicBox) return metadata.BOX;
    const response = boxResponses[0];
    // Responses may still belong to previous URLs right after they change
    if (!response || response.url !== boxUrls[0] || response.loading) return null;
    if (response.error) throw response.error;
    const vectors = new Float32Array(response.payload);
    if (vectors.length !== BOX_COORDINATES)
      throw new Error(`Unexpected box length: ${vectors.length}`);
    return [...vectors];
  }, [isDynamicBox, metadata.BOX, boxUrls, boxResponses]);

  // NGL selections of the residues in contact on each side
  const contactSelections = useMemo(() => {
    if (!topology) return null;
    const getResidueSelection = apiSelection => {
      if (!apiSelection) throw new Error('The PBC contacts warning is missing a selection');
      const atomIndices = [...topology.parseApiSelection(apiSelection).atomIndices];
      if (atomIndices.length === 0) throw new Error('The PBC contacts warning has an empty selection');
      const residueIndices = [...new Set(topology.atom2residueIndices(atomIndices))];
      return topology.residueIndices2Ngl(residueIndices).rangedSelection;
    };
    return { a: getResidueSelection(warning.selection_a), b: getResidueSelection(warning.selection_b) };
  }, [topology, warning]);

  return useMemo(() => {
    if (!boxVectors || !contactSelections) return null;
    const defaultRepresentations = topology.defaultRepresentations;
    const { forward, backward } = getContactImages(boxVectors, warning.images);
    const forwardComponent = `Image ${forward.label}`;
    const backwardComponent = `Image ${backward.label}`;
    const components = [
      { name: MAIN_COMPONENT, frame },
      { name: forwardComponent, frame, translation: forward.translation },
      { name: backwardComponent, frame, translation: backward.translation },
    ];
    // Highlight residues in contact
    // In the system both sides are in contact with an image
    // In the forward image only selection B is in contact with the system, and selection A in the backward image
    const getContactRepresentation = (selection, component, label) => ({
      name: `Residues in contact (${label})`,
      selection,
      type: 'ball+stick',
      color: CONTACT_COLOR,
      component,
    });
    const bothSelections = `(${contactSelections.a}) or (${contactSelections.b})`;
    const representations = [
      ...uncoverContacts(defaultRepresentations, bothSelections)
        .map(representation => ({ ...representation, component: MAIN_COMPONENT })),
      getContactRepresentation(contactSelections.a, MAIN_COMPONENT, 'A'),
      getContactRepresentation(contactSelections.b, MAIN_COMPONENT, 'B'),
    ];
    // Selections in contact with the system in each image
    [[forward, contactSelections.b], [backward, contactSelections.a]].forEach(([image, contactSelection]) => {
      const component = `Image ${image.label}`;
      uncoverContacts(defaultRepresentations, contactSelection).forEach(representation => representations.push({
        ...representation,
        name: `${representation.name} (image ${image.label})`,
        color: IMAGE_COLOR,
        component,
      }));
    });
    representations.push(
      getContactRepresentation(contactSelections.b, forwardComponent, `B, image ${forward.label}`),
      getContactRepresentation(contactSelections.a, backwardComponent, `A, image ${backward.label}`),
    );
    // Focus on the contact between selection A in the system and selection B in the forward image
    // Focus again once the frame is loaded, since its coordinates may be far from the structure ones
    const initialFocus = {
      parts: [
        { comp: MAIN_COMPONENT, sele: contactSelections.a },
        { comp: forwardComponent, sele: contactSelections.b },
      ],
      afterLoad: true,
    };
    return { components, representations, initialFocus };
  }, [boxVectors, contactSelections, topology, warning, frame]);
};

export default usePbcContactsView;
