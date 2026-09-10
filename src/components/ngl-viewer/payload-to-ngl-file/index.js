import { Frames } from 'ngl';
import { caluclateAverage } from 'src/utils/auxiliar-functions';

// Set the number of bytes per element in trajectory data
const BYTES_PER_COORDINATE = 4; // float 32
const COORDINATES_PER_ATOM = 3; // x, y and z
const BYTES_PER_ATOM = BYTES_PER_COORDINATE * COORDINATES_PER_ATOM;

// This converts the trajectory payload (i.e. atom coordinates in raw binary data) into NGL formatted coordinates
const payloadToNGLCoordinates = (
  trajectoryData,
  trajectoryAtoms,
  trajectoryFrames,
  centering,
) => {
  // Parse binary to coordinates
  const trajectoryCoordinates = new Float32Array(trajectoryData);
  // If the centering was required then we will center the coordinates for every frame
  if (centering) centerCoordinates(trajectoryCoordinates, trajectoryAtoms);
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
  centering,
) => {
  // Parse binary to coordinates
  const trajectoryCoordinates = new Float32Array(trajectoryData);
  // If the centering was required then we will center the coordinates for every frame
  if (centering) centerCoordinates(trajectoryCoordinates, trajectoryAtoms);
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
  centering,
) => {
  // Parse binary to coordinates
  const trajectoryCoordinates = new Float32Array(trajectoryData);
  // If the centering was required then we will center the coordinates for every frame
  if (centering) centerCoordinates(trajectoryCoordinates, trajectoryAtoms);
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
  centering,
) => {
  if (!(topology && trajectoryData)) return;

  let coordinates;
  // In case topology and trajectory atoms match go for the canonical parsing
  if (trajectoryAtoms === topology.atomCount)
    coordinates = payloadToNGLCoordinates(
      trajectoryData,
      trajectoryAtoms,
      trajectoryFrames,
      centering,
    );
  else if (atomIndices)
    coordinates = payloadToNGLCoordinatesFiltered(
      topology.atomCount,
      atomIndices,
      trajectoryData,
      trajectoryAtoms,
      trajectoryFrames,
      centering,
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
      centering,
    );

  // If we do not have coordinates at this point it may mean the topology and trajectory are not matching in atom number
  if (!coordinates)
    throw new Error(`Topology and trajectory data may not match`);

  // If coordinates are all the same then stop here
  // Representing many atoms in the same place may stress NGL a lot for some reason
  // This can make the whole navigator crash if tried with many atoms
  // Check only the first 10 coordinates to make it faster
  const sampleFrame = coordinates[0];
  const sampleCoordinates = new Set(sampleFrame.slice(0, 30))
  if (sampleCoordinates.size <= 3)
    throw new Error('Trajectory coordinates are repeated');

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
  centering,
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
      centering,
    );
  else if (atomIndices)
    coordinates = payloadToNGLCoordinatesFiltered(
      topology.atomCount,
      atomIndices,
      newTrajectoryData,
      trajectoryAtoms,
      newTrajectoryFrames,
      centering,
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
      centering,
    );

  // If we do not have coordinates at this point it may mean the topology and trajectory are not matching in atom number
  if (!coordinates)
    throw new Error(`Topology and trajectory data may not match`);

  // Finally update the NGL file coordinates
  file.frames = file.frames.concat(coordinates);
};

// Center a list of coordinates
// Mutate the original array
// DANI: Si en lugar de mutar la original devuelvo una nueva entonces no funciona, sabe dios por que
const centerCoordinates = (coordinates, atomCount) => {
  // Note that we must do the average per frame, never more than one frame at a time
  // However the coordinates may include one or more frames, so we must check
  const coordinatesPerFrameCount = atomCount * 3;
  const frameCount = coordinates.length / coordinatesPerFrameCount;
  // Iterate frames
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    const frameStartingCoordinateIndex = frameIndex * coordinatesPerFrameCount;
    // Iterating dimensions
    ['x', 'y', 'z'].forEach((dimension, offset) => {
      // Get frame coordinates for the current dimension
      const dimensionCoordinates = [];
      for (let atomIndex = 0; atomIndex < atomCount; atomIndex++) {
        const nextCoordinateIndex = atomIndex * 3 + offset + frameStartingCoordinateIndex;
        const nextCoordinate = coordinates[nextCoordinateIndex];
        dimensionCoordinates.push(nextCoordinate);
      }
      // Calculate the average
      const average = caluclateAverage(dimensionCoordinates);
      // Normalize current coordinates by substracting the average
      const normalizedDimensionCoordinates = dimensionCoordinates.map(coord => coord - average);
      // Apply the new normalized coordinates
      for (let atomIndex = 0; atomIndex < atomCount; atomIndex++) {
        const nextCoordinateIndex = atomIndex * 3 + offset + frameStartingCoordinateIndex;
        coordinates[nextCoordinateIndex] = normalizedDimensionCoordinates[atomIndex];
      }
    })
  }
}