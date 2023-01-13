import { StateTransformer } from 'molstar/lib/mol-state';
import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { Task } from 'molstar/lib/mol-task';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { Coordinates, Time } from 'molstar/lib/mol-model/structure';

const CreateTransformer = StateTransformer.builderFactory('custom-namespace');

export const TrajectoryFromCustomData = CreateTransformer({
    name: 'trajectory-from-custom-data',
    display: 'Trajectory',
    from: PluginStateObject.Root,
    to: PluginStateObject.Molecule.Coordinates,
    params: {
        data: PD.Value<Uint8Array>(new Uint8Array(), { isHidden: true }),
        natoms: PD.Value<number>(0, { isHidden: true }),
    },
})({
    apply({ params }) {
        return Task.create('Parse atom coordinates', async (ctx) => {
            //ctx.update({ canAbort: true, message: 'Parsing trajectory...' });
            return await customParse(params.data, params.natoms);
        });
    },
});

// Parse binary atom coordinates
async function customParse (data: Uint8Array, natoms: number) {
    // Check the number of atoms to not be 0 (the default)
    if (natoms === 0) throw new Error('Number of atoms is 0');
    // Each coordinates is a float32 an thus it takes 4 bytes of space
    const coordSize = 4;
    // Each atom has 3 coordinates: x, y and z
    const atomSize = coordSize * 3;
    // Each frame has coordinates for every atom
    const frameSize = atomSize * natoms;
    // Check data contains whole frames
    if (data.byteLength % frameSize !== 0) throw new Error('Trajectory data ends abruptly');
    // Calculate the number of frames
    const nframes = data.byteLength / frameSize;
    // Convert binary data to coordinates
    const coordinates = new Float32Array(data);
    // Set a list with the already read coordinates
    const frameCoordinates = [];
    // Keep track of the coordinate we are reading
    let count = 0;
    // Iterate over each frame number
    for (let frame = 0; frame < nframes; frame++) {
        // Coordinates are saved separately by dimensions, as it is done in molstar
        const x_coords = new Float32Array(natoms);
        const y_coords = new Float32Array(natoms);
        const z_coords = new Float32Array(natoms);
        // Iterate over each atom number
        for (let atom = 0; atom < natoms; atom++) {
            // Read the current atom coordinates
            x_coords[atom] = coordinates[count]
            y_coords[atom] = coordinates[count+1];
            z_coords[atom] = coordinates[count+2];
            // Update the byte offset
            count += 3;
        }
        // Push the current frame to the overall frames list
        frameCoordinates.push({
            x: x_coords,
            y: y_coords,
            z: z_coords,
            // Add a few extra parameters on each frame
            elementCount: natoms,
            time: Time(frame, 'step'),
            xyzOrdering: { isIdentity: true }
        });
    }
    // Set the molstar object for coordinates
    const molstarCoords = Coordinates.create(
        frameCoordinates,
        Time(1, 'step'), // deltaTime
        Time(0, 'step') // offsetTime
    );
    return new PluginStateObject.Molecule.Coordinates(molstarCoords, { label: 'label' });
}