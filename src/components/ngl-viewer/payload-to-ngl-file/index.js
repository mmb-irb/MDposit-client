import { Frames } from 'ngl';

// Set the number of bytes per element in trajectory data
const BYTES_PER_COORDINATE = 4; // float 32
const COORDINATES_PER_ATOM = 3; // x, y and z
const BYTES_PER_ATOM = BYTES_PER_COORDINATE * COORDINATES_PER_ATOM;

// This converts the trajectory payload (i.e. atom coordinates in raw binary data) into NGL formatted coordinates
const payloadToNGLCoordinates = (
  trajectoryData,
  trajectoryAtoms,
  trajectoryFrames,
) => {
  // Parse binary to coordinates
  const trajectoryCoordinates = new Float32Array(trajectoryData);
  try {
    // Save all coordinates here
    // This array is to be returned at the end
    const overallCoordinates = [];
    for (let i = 0; i < trajectoryFrames; i++) {
      // Create a new array with the length of the number of atoms in the pdbFile * 3
      const coordinates = new Float32Array(
        trajectoryAtoms * COORDINATES_PER_ATOM,
      );
      coordinates.set(
        trajectoryCoordinates.subarray(
          i * trajectoryAtoms * COORDINATES_PER_ATOM,
          (i + 1) * trajectoryAtoms * COORDINATES_PER_ATOM,
        ),
      );
      // Push the new coordinates each frame
      overallCoordinates.push(coordinates);
    }
    return overallCoordinates;
  } catch (error) {
    // If this fails the topology may not match the trajectory in atom number
    return null;
  }
};

// This converts the trajectory payload (i.e. atom coordinates in raw binary data) into NGL formatted coordinates
// This alternative function is used when the trajectory has less atoms than the structure
// This may happen when trajectory data contains only heavy or backbone atoms (e.g. pca projections)
const payloadToNGLCoordinatesFiltered = (
  atomCount,
  atomIndices,
  trajectoryData,
  trajectoryAtoms,
  trajectoryFrames,
) => {
  // Parse binary to coordinates
  const trajectoryCoordinates = new Float32Array(trajectoryData);
  // Check atom number to be as expected
  const expectedAtomNumber =
    trajectoryCoordinates.length / COORDINATES_PER_ATOM / trajectoryFrames;
  if (expectedAtomNumber !== trajectoryAtoms) {
    console.log('Number of coordinates: ' + trajectoryCoordinates.length);
    console.log('Number of frames: ' + trajectoryFrames);
    console.log('Expected number of atoms: ' + expectedAtomNumber);
    console.log('Actual number of atoms: ' + trajectoryAtoms);
    throw new Error(`Trajectory atom number is wrong`);
  }

  try {
    // Save all coordinates here
    // This array is to be returned at the end
    const overallCoordinates = [];
    for (let i = 0; i < trajectoryFrames; i++) {
      // Create a new array with the length of the number of atoms in the structure * 3
      const coordinates = new Float32Array(atomCount * COORDINATES_PER_ATOM);
      let k = 0;
      // Create our own trajectory with coordinates only for the specified atoms
      // The coordinates of the excluded atoms are set to 0
      // This makes the trajectory compatible with the structure
      for (let j = 0; j < atomCount; j++) {
        //if (k >= trajectoryAtoms) break;
        if (atomIndices.indexOf(j) !== -1) {
          coordinates[j * COORDINATES_PER_ATOM] =
            trajectoryCoordinates[
              i * trajectoryAtoms * COORDINATES_PER_ATOM +
                k * COORDINATES_PER_ATOM
            ];
          coordinates[j * COORDINATES_PER_ATOM + 1] =
            trajectoryCoordinates[
              i * trajectoryAtoms * COORDINATES_PER_ATOM +
                k * COORDINATES_PER_ATOM +
                1
            ];
          coordinates[j * COORDINATES_PER_ATOM + 2] =
            trajectoryCoordinates[
              i * trajectoryAtoms * COORDINATES_PER_ATOM +
                k * COORDINATES_PER_ATOM +
                2
            ];
          k++;
        }
      }
      // Push the new coordinates each frame
      overallCoordinates.push(coordinates);
    }
    return overallCoordinates;
  } catch (e) {
    // If this fails the topology may not match the trajectory in atom number
    return null;
  }
};

// This converts the trajectory payload (i.e. atom coordinates in raw binary data) into NGL formatted coordinates
// This alternative function is used when the trajectory has less atoms than the structure
// This may happen when trajectory data contains only heavy or backbone atoms (e.g. pca projections)
const payloadToNGLCoordinatesAlternative = (
  pdbFile,
  trajectoryData,
  trajectoryAtoms,
  trajectoryFrames,
) => {
  // Parse binary to coordinates
  const trajectoryCoordinates = new Float32Array(trajectoryData);
  // Check atom number to be as expected
  if (
    trajectoryCoordinates.length / COORDINATES_PER_ATOM / trajectoryFrames !==
    trajectoryAtoms
  )
    throw new Error(`Trajectory atom number is wrong`);

  let format = '';

  // Then count different combinations of atoms in the pdbFile
  let k = 0;
  let backboneAtoms = 0;
  let heavyAtoms = 0;
  for (let a = 0; a < pdbFile.atomCount; a++) {
    // DANI: He probado a quitar esta condición. hay que probar que funcione bien en la vieja model
    // DANI: En las trayectorias del Shaw el 'isProtein' no funcionaba y devolvía siempre 'false'
    //if (!pdbFile.getAtomProxy(a).isProtein()) break;
    if (k >= trajectoryAtoms) break;
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
  if (trajectoryAtoms === backboneAtoms) format = 'backbone';
  else if (trajectoryAtoms === heavyAtoms) format = 'heavy';
  else
    console.error(
      `Number of atoms does not match any defined atoms selection
      Number of atoms in trajectory: ${trajectoryAtoms}
      Expected backbone atoms: ${backboneAtoms}
      Expected heavy atoms: ${heavyAtoms}`,
    );
  try {
    // Save all coordinates here
    // This array is to be returned at the end
    const overallCoordinates = [];
    for (let i = 0; i < trajectoryFrames; i++) {
      // Create a new array with the length of the number of atoms in the pdbFile * 3
      const coordinates = new Float32Array(
        pdbFile.atomCount * COORDINATES_PER_ATOM,
      );
      let k = 0;
      // Create our own trajectory with coordinates only for the specified atoms
      // The coordinates of the excluded atoms are set to 0
      // This makes the trajectory compatible with the pdbFile
      if (format === 'backbone') {
        for (let j = 0; j < pdbFile.atomCount; j++) {
          if (k >= trajectoryAtoms) break;
          if (
            pdbFile.getAtomProxy(j).atomname === 'C' ||
            pdbFile.getAtomProxy(j).atomname === 'CA' ||
            pdbFile.getAtomProxy(j).atomname === 'N'
          ) {
            coordinates[j * COORDINATES_PER_ATOM] =
              trajectoryCoordinates[
                i * trajectoryAtoms * COORDINATES_PER_ATOM +
                  k * COORDINATES_PER_ATOM
              ];
            coordinates[j * COORDINATES_PER_ATOM + 1] =
              trajectoryCoordinates[
                i * trajectoryAtoms * COORDINATES_PER_ATOM +
                  k * COORDINATES_PER_ATOM +
                  1
              ];
            coordinates[j * COORDINATES_PER_ATOM + 2] =
              trajectoryCoordinates[
                i * trajectoryAtoms * COORDINATES_PER_ATOM +
                  k * COORDINATES_PER_ATOM +
                  2
              ];
            k++;
          }
        }
      }
      if (format === 'heavy') {
        for (let j = 0; j < pdbFile.atomCount; j++) {
          if (k >= trajectoryAtoms) break;
          if (pdbFile.getAtomProxy(j).element !== 'H') {
            coordinates[j * COORDINATES_PER_ATOM] =
              trajectoryCoordinates[
                i * trajectoryAtoms * COORDINATES_PER_ATOM +
                  k * COORDINATES_PER_ATOM
              ];
            coordinates[j * COORDINATES_PER_ATOM + 1] =
              trajectoryCoordinates[
                i * trajectoryAtoms * COORDINATES_PER_ATOM +
                  k * COORDINATES_PER_ATOM +
                  1
              ];
            coordinates[j * COORDINATES_PER_ATOM + 2] =
              trajectoryCoordinates[
                i * trajectoryAtoms * COORDINATES_PER_ATOM +
                  k * COORDINATES_PER_ATOM +
                  2
              ];
            k++;
          }
        }
      }
      // Push the new coordinates each frame
      overallCoordinates.push(coordinates);
    }
    return overallCoordinates;
  } catch (e) {
    // If this fails the topology may not match the trajectory in atom number
    return null;
  }
};

// This converts the trajectory payload (i.e. atom coordinates in raw binary data) into an NGL object
// This object can be further added to a NGL stage component
export const setNGLFile = (
  topology,
  trajectoryData,
  trajectoryAtoms,
  trajectoryFrames,
  atomIndices,
) => {
  if (!(topology && trajectoryData)) return;

  let coordinates;
  // In case topology and trajectory atoms match go for the canonical parsing
  if (trajectoryAtoms === topology.atomCount)
    coordinates = payloadToNGLCoordinates(
      trajectoryData,
      trajectoryAtoms,
      trajectoryFrames,
    );
  else if (atomIndices)
    coordinates = payloadToNGLCoordinatesFiltered(
      topology.atomCount,
      atomIndices,
      trajectoryData,
      trajectoryAtoms,
      trajectoryFrames,
    );
  // Otherwise it may mean the trajectory has only heavy/backbone atoms
  // Then parse it taking this in count
  // DANI: Esto es más un arreglo que no algo permanente
  // DANI: Lo suyo sería que en estos casos se pida la estructura solo con los átomos que hacen falta
  else
    coordinates = payloadToNGLCoordinatesAlternative(
      topology,
      trajectoryData,
      trajectoryAtoms,
      trajectoryFrames,
    );

  // If we do not have coordinates at this point it may mean the topology and trajectory are not matching in atom number
  if (!coordinates)
    throw new Error(`Topology and trajectory data may not match`);

  // Finally build the NGL object and add the parsed coordinates
  const file = new Frames('Dynamically generated trajectory', '');
  file.coordinates = coordinates;
  return file;
};

// This updates an already set NGL object by adding new trajectory data
export const updateNGLFile = (
  file,
  topology,
  trajectoryData,
  trajectoryAtoms,
  trajectoryFrames,
  atomIndices,
) => {
  if (!(file && topology && trajectoryData)) return;

  // The NGL file may already have trajectory data
  // There is no need to process those coordinates again, so they must discarded from the parsing

  // Find out how many frames are already loaded
  const currentFrames = file.frames.length;

  // If there are as many frames already as the new trajectory frames then we have nothing to do
  if (currentFrames >= trajectoryFrames) return;

  // Calculate how many bytes we must discard and discard them from the begining of the array buffer
  const discardBytes = currentFrames * trajectoryAtoms * BYTES_PER_ATOM;
  const newTrajectoryData = trajectoryData.slice(discardBytes);
  const newTrajectoryFrames = trajectoryFrames - currentFrames;

  let coordinates;
  // In case topology and trajectory atoms match go for the canonical parsing
  if (trajectoryAtoms === topology.atomCount)
    coordinates = payloadToNGLCoordinates(
      newTrajectoryData,
      trajectoryAtoms,
      newTrajectoryFrames,
    );
  else if (atomIndices)
    coordinates = payloadToNGLCoordinatesFiltered(
      topology.atomCount,
      atomIndices,
      newTrajectoryData,
      trajectoryAtoms,
      newTrajectoryFrames,
    );
  // Otherwise it may mean the trajectory has only heavy/backbone atoms
  // Then parse it taking this in count
  // DANI: Esto es más un arreglo que no algo permanente
  // DANI: Lo suyo sería que en estos casos se pida la estructura solo con los átomos que hacen falta
  else
    coordinates = payloadToNGLCoordinatesAlternative(
      topology,
      newTrajectoryData,
      trajectoryAtoms,
      newTrajectoryFrames,
    );

  // If we do not have coordinates at this point it may mean the topology and trajectory are not matching in atom number
  if (!coordinates)
    throw new Error(`Topology and trajectory data may not match`);

  // Finally update the NGL file coordinates
  file.frames = file.frames.concat(coordinates);
};
