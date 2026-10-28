import { StateTransformer } from 'molstar/lib/mol-state';
import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { Task } from 'molstar/lib/mol-task';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { Coordinates, Frame, Time } from 'molstar/lib/mol-model/structure';
import { SecondaryStructureProvider } from 'molstar/lib/mol-model-props/computed/secondary-structure';
import { DefaultDSSPComputationProps } from 'molstar/lib/mol-model-props/computed/secondary-structure/dssp';

// Factory of the custom molstar state transformers of this app
export const CreateTransformer = StateTransformer.builderFactory('custom-namespace');

// Props deliberately different from the provider's default ('auto') - see FrozenSecondaryStructure
const FROZEN_SECONDARY_STRUCTURE_PROPS = {
    type: { name: 'dssp', params: DefaultDSSPComputationProps },
};

// Computes secondary structure once and then re-plants that same result on every later frame,
// instead of letting it be recomputed from scratch each time
//
// Cartoon representations attach the SecondaryStructureProvider on every update, unconditionally.
// That provider is 'root'-typed, so it caches on the root structure's property data - but playback
// replaces the root structure every frame (a coordinate-only remapModel), and Structure.create does
// not carry property data across. So the cache is always empty and DSSP is recomputed every frame,
// for a topology like ours that has no HELIX/SHEET records to read instead
//
// Sitting between the root structure and the components, this decorator re-plants the cached result
// before the representations below it update, so their attach() call finds it and returns early.
// Two details make that work:
//  - the cached value is a Map keyed by unit invariantId, and remapModel preserves invariantId, so
//    the frame-0 result stays structurally valid for every other frame
//  - CustomStructureProperty.set silently drops a write whose props equal the defaults, hence
//    FROZEN_SECONDARY_STRUCTURE_PROPS naming 'dssp' explicitly rather than leaving it at 'auto'
// Note this holds secondary structure fixed at the first frame, which is also what the NGL viewer
// effectively does (it never recomputes it while stepping through coordinates)
export const FrozenSecondaryStructure = CreateTransformer({
    name: 'frozen-secondary-structure',
    display: 'Frozen Secondary Structure',
    isDecorator: true,
    from: PluginStateObject.Molecule.Structure,
    to: PluginStateObject.Molecule.Structure,
    params: {},
})({
    apply({ a, cache }, plugin: any) {
        return Task.create('Compute secondary structure', async ctx => {
            const structure = a.data;
            // Compute it the normal way this one time, then keep the result
            await SecondaryStructureProvider.attach(
                { runtime: ctx, assetManager: plugin.managers.asset, errorContext: plugin.errorContext },
                structure,
            );
            const computed = SecondaryStructureProvider.get(structure).value;
            (cache as any).secondaryStructure = computed;
            // Re-plant under the frozen props, so later attach() calls short-circuit
            if (computed) {
                SecondaryStructureProvider.set(structure, FROZEN_SECONDARY_STRUCTURE_PROPS as any, computed);
            }
            return new PluginStateObject.Molecule.Structure(structure, {
                label: a.label,
                description: a.description,
            });
        });
    },
    update({ a, b, cache }) {
        const computed = (cache as any).secondaryStructure;
        // Nothing cached to re-plant (the first compute found no protein), so there is nothing to
        // save either - let the normal path run rather than pinning an empty result forever
        if (!computed) return StateTransformer.UpdateResult.Unchanged;
        if (a.data === b.data) return StateTransformer.UpdateResult.Unchanged;
        // Deliberately NOT Recreate: recreating would re-run apply (recomputing DSSP) and would
        // dispose the shared structure's custom property descriptors on every single frame
        SecondaryStructureProvider.set(a.data, FROZEN_SECONDARY_STRUCTURE_PROPS as any, computed);
        b.data = a.data;
        b.label = a.label;
        b.description = a.description;
        return StateTransformer.UpdateResult.Updated;
    },
});

export const TrajectoryFromCustomData = CreateTransformer({
    name: 'trajectory-from-custom-data',
    display: 'Trajectory',
    from: PluginStateObject.Root,
    to: PluginStateObject.Molecule.Coordinates,
    params: {
        // A view of the downloaded coordinates, so they are not copied (see parseCoordinateFrames)
        coordinates: PD.Value<Float32Array>(new Float32Array(), { isHidden: true }),
        natoms: PD.Value<number>(0, { isHidden: true }),
        // Atoms to center every frame around, if any (see parseCoordinateFrames)
        centering: PD.Value<ArrayLike<number> | null>(null, { isHidden: true }),
    },
})({
    apply({ params }) {
        return Task.create('Parse atom coordinates', async (ctx) => {
            //ctx.update({ canAbort: true, message: 'Parsing trajectory...' });
            const frames = parseCoordinateFrames(params.coordinates, params.natoms, 0, params.centering);
            const molstarCoords = Coordinates.create(
                frames,
                Time(1, 'step'), // deltaTime
                Time(0, 'step') // offsetTime
            );
            return new PluginStateObject.Molecule.Coordinates(molstarCoords, { label: 'label' });
        });
    },
});

// Parse atom coordinates into molstar per-frame coordinate objects
// Coordinates are the downloaded bytes read as floats: x, y and z of every atom, one frame after the other
// Exported (and kept synchronous/task-free) so the viewer can also call it directly to parse just the
// newly downloaded bytes of a trajectory that is still streaming in, without going through the
// state-tree transform machinery for every single downloaded chunk
// 'frameOffset' lets the resulting frames' Time values stay monotonic when parsing a later chunk
// 'centering' atoms, if any, are kept at the origin by translating every frame, as the NGL viewer does
export function parseCoordinateFrames(
    coordinates: Float32Array, natoms: number, frameOffset: number = 0, centering: ArrayLike<number> | null = null,
): Frame[] {
    // Check the number of atoms to not be 0 (the default)
    if (natoms === 0) throw new Error('Number of atoms is 0');
    // Each coordinates is a float32 an thus it takes 4 bytes of space
    const coordSize = 4;
    // Each atom has 3 coordinates: x, y and z
    const atomSize = coordSize * 3;
    // Each frame has coordinates for every atom
    const frameSize = atomSize * natoms;
    // Check data contains whole frames
    if (coordinates.byteLength % frameSize !== 0) throw new Error('Trajectory data ends abruptly');
    // Calculate the number of frames
    const nframes = coordinates.byteLength / frameSize;
    // Set a list with the already read coordinates
    const frameCoordinates: Frame[] = [];
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
        if (centering && centering.length > 0) {
            // Calculate the geometric center of the centering atoms and translate all atoms by it
            let xSum = 0, ySum = 0, zSum = 0;
            for (let i = 0; i < centering.length; i++) {
                xSum += x_coords[centering[i]];
                ySum += y_coords[centering[i]];
                zSum += z_coords[centering[i]];
            }
            const x = xSum / centering.length, y = ySum / centering.length, z = zSum / centering.length;
            for (let atom = 0; atom < natoms; atom++) {
                x_coords[atom] -= x;
                y_coords[atom] -= y;
                z_coords[atom] -= z;
            }
        }
        // Push the current frame to the overall frames list
        frameCoordinates.push({
            x: x_coords,
            y: y_coords,
            z: z_coords,
            // Add a few extra parameters on each frame
            elementCount: natoms,
            time: Time(frameOffset + frame, 'step'),
            xyzOrdering: { isIdentity: true }
        });
    }
    return frameCoordinates;
}