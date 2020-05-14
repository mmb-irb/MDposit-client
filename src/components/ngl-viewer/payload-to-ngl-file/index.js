import { Frames } from 'ngl';

const COORDINATES_NUMBER = 3;

const payloadToNGLFile = (
  pdbFile,
  dcdPayload,
  atoms,
  nFrames,
  isProjection,
  isOneFrame,
) => {
  if (!(pdbFile && dcdPayload)) return;

  const view = new Float32Array(dcdPayload);

  const file = new Frames('Dynamically generated trajectory', '');

  let length = nFrames;
  let format = '';
  if (isProjection) {
    // This is a standard: PCA projections have 20 frames
    length = 20;
    // PCA projections are asumed to not have atoms of membrane, solvent, ions, etc.
    // PCA projections may have only heavy atoms or the backbone and this data is not explicit
    // Try to deduct which atoms are in the PCA projection by counting atoms and coordinatess
    // First, calculate the number of atoms in the pca projection
    const viewAtoms = view.length / (length * COORDINATES_NUMBER);
    // Then count different combinations of atoms in the pdbFile
    let k = 0;
    let backboneAtoms = 0;
    let heavyAtoms = 0;
    for (let a = 0; a < pdbFile.atomCount; a++) {
      if (!pdbFile.getAtomProxy(a).isProtein()) break;
      if (k >= atoms) break;
      if (
        pdbFile.getAtomProxy(a).atomname === 'C' ||
        pdbFile.getAtomProxy(a).atomname === 'CA' ||
        pdbFile.getAtomProxy(a).atomname === 'N'
      ) {
        backboneAtoms += 1;
      }
      if (pdbFile.getAtomProxy(a).element !== 'H') {
        heavyAtoms += 1;
      }
    }
    // Finally check which count matches the expected number of atoms
    if (viewAtoms === backboneAtoms) format = 'backbone';
    else if (viewAtoms === heavyAtoms) format = 'heavy';
    else
      console.error(
        `Number of atoms in PCA projection does not match any defined atoms selection
        Number of atoms: ${viewAtoms}
        Expected backbone atoms: ${backboneAtoms}
        Expected heavy atoms: ${heavyAtoms}`,
      );
  } else if (isOneFrame) {
    length = 1;
  }
  try {
    for (let i = 0; i < length; i++) {
      // Create a new array with the length of the number of atoms in the pdbFile * 3
      const coordinates = new Float32Array(
        pdbFile.atomCount * COORDINATES_NUMBER,
      );
      let k = 0;
      // If it is a PCA projection
      if (isProjection) {
        // Create our own trajectory with coordinates only for the specified atoms
        // The coordinates of the excluded atoms are set to 0
        // This makes the trajectory compatible with the pdbFile
        if (format === 'backbone') {
          for (let j = 0; j < pdbFile.atomCount; j++) {
            if (k >= atoms) break;
            if (
              pdbFile.getAtomProxy(j).atomname === 'C' ||
              pdbFile.getAtomProxy(j).atomname === 'CA' ||
              pdbFile.getAtomProxy(j).atomname === 'N'
            ) {
              coordinates[j * COORDINATES_NUMBER] =
                view[i * atoms * COORDINATES_NUMBER + k * COORDINATES_NUMBER];
              coordinates[j * COORDINATES_NUMBER + 1] =
                view[
                  i * atoms * COORDINATES_NUMBER + k * COORDINATES_NUMBER + 1
                ];
              coordinates[j * COORDINATES_NUMBER + 2] =
                view[
                  i * atoms * COORDINATES_NUMBER + k * COORDINATES_NUMBER + 2
                ];
              k++;
            }
          }
        }
        if (format === 'heavy') {
          for (let j = 0; j < pdbFile.atomCount; j++) {
            if (k >= atoms) break;
            if (pdbFile.getAtomProxy(j).element !== 'H') {
              coordinates[j * COORDINATES_NUMBER] =
                view[i * atoms * COORDINATES_NUMBER + k * COORDINATES_NUMBER];
              coordinates[j * COORDINATES_NUMBER + 1] =
                view[
                  i * atoms * COORDINATES_NUMBER + k * COORDINATES_NUMBER + 1
                ];
              coordinates[j * COORDINATES_NUMBER + 2] =
                view[
                  i * atoms * COORDINATES_NUMBER + k * COORDINATES_NUMBER + 2
                ];
              k++;
            }
          }
        }
      } else {
        // if it is not a PCA projection
        coordinates.set(
          view.subarray(
            i * atoms * COORDINATES_NUMBER,
            (i + 1) * atoms * COORDINATES_NUMBER,
          ),
        );
      }
      // Push the new coordinates each frame
      file.coordinates.push(coordinates);
    }
    return file;
  } catch (error) {
    console.error(error);
    // If this fails the topology may not match the trajectory
    throw new Error(`Topology and trajectory data may not match`);
  }
};

export default payloadToNGLFile;
