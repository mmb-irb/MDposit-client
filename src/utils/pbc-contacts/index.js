// Tools for the warning of contacts across periodic boundaries (PBC), tagged as 'pbcontacts'
// This warning includes the frame with most contacts and the atoms in contact
//  {
//    tag: 'pbcontacts',
//    frame: int, (0-based index of the trajectory frame)
//    selection_a: { at: [ atom index or [first, last] range ] },
//    selection_b: { at: [ atom index or [first, last] range ] },
//    images: [ int, int, int ], (-1, 0 or +1 times the box vectors a, b and c)
//  }
// Atoms in selection B translated by the images vector are in contact with atoms in selection A
// Equivalently, atoms in selection A translated by the opposite vector are in contact with atoms in selection B

export const PBC_CONTACTS_TAG = 'pbcontacts';

// Value of metadata.BOX when the box changes along the trajectory
// In this case the box of every frame is in the box.bin file
export const DYNAMIC_BOX = 'dyn';

const AXIS_NAMES = ['x', 'y', 'z'];
const IMAGE_VALUES = new Set([-1, 0, 1]);

// Get the PBC contacts warning, if any
// There should never be more than one warning with the same tag but, if so, use the first one
export const getPbcContactsWarning = metadata => {
  if (!metadata || !metadata.WARNINGS) return null;
  return metadata.WARNINGS.find(warning => warning.tag === PBC_CONTACTS_TAG) || null;
};

// Set if PBC contacts may be represented
// We need both the warning and the simulation box to place the periodic images
export const canShowPbcContacts = metadata => !!getPbcContactsWarning(metadata) && !!metadata.BOX;

// Set a readable label of an image (e.g. '+y' or '+x-y')
const getImageLabel = images => images
  .map((image, v) => image === 0 ? '' : (image > 0 ? '+' : '-') + AXIS_NAMES[v])
  .join('');

// Get the periodic images which contact the system
// Box vectors are the 3 rows (a, b and c) as an array of 3 arrays or a flat array of 9 values
// Return both images:
//  - forward: the system translated by the images vector, where selection B contacts selection A in the system
//  - backward: the system translated by the opposite vector, where selection A contacts selection B in the system
export const getContactImages = (boxVectors, images) => {
  const flatVectors = boxVectors.flat();
  if (flatVectors.length !== 9) throw new Error(`Unexpected box vectors: ${JSON.stringify(boxVectors)}`);
  if (!Array.isArray(images) || images.length !== 3 || !images.every(image => IMAGE_VALUES.has(image)))
    throw new Error(`Unexpected PBC contacts images: ${JSON.stringify(images)}`);
  if (images.every(image => image === 0)) throw new Error('PBC contacts warning has no images to cross');
  const translation = [0, 0, 0];
  images.forEach((image, v) => {
    for (let dimension = 0; dimension < 3; dimension++)
      translation[dimension] += image * flatVectors[v * 3 + dimension];
  });
  return {
    forward: { label: getImageLabel(images), translation },
    backward: {
      label: getImageLabel(images.map(image => -image)),
      translation: translation.map(value => 0 - value), // Avoid -0
    },
  };
};
