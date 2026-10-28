import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { Cylinders } from 'molstar/lib/mol-geo/geometry/cylinders/cylinders';
import { CylindersBuilder } from 'molstar/lib/mol-geo/geometry/cylinders/cylinders-builder';
import { Shape } from 'molstar/lib/mol-model/shape';
import { StructureElement, Unit } from 'molstar/lib/mol-model/structure';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';

import { CreateTransformer } from '../molstar-parser';

// Name of the atom pairs shapes, to tell them apart from other shapes (e.g. meshes) when hovered
export const ATOM_PAIRS_SHAPE = 'atom-pairs';

// Radius of the links, as in NGL distance representations
const DEFAULT_RADIUS = 0.2; // Å

// Find where every given atom is in a structure, by its index in the loaded topology: its unit id and its element
// Every frame of a trajectory has the same units and elements, so atoms are found once (see AtomPairsShape)
export const findAtoms = (structure, atomIndices) => {
  const wanted = new Set(atomIndices);
  const atoms = new Map();
  for (const unit of structure.units) {
    if (!Unit.isAtomic(unit)) continue;
    const { atomSourceIndex } = unit.model.atomicHierarchy;
    for (let i = 0; i < unit.elements.length; i++) {
      const element = unit.elements[i];
      const atomIndex = atomSourceIndex.value(element);
      if (wanted.has(atomIndex)) atoms.set(atomIndex, { unitId: unit.id, element });
    }
  }
  return atoms;
};

// Build a molstar shape with a cylinder between the atoms of every pair, as NGL distance representations do
// Atoms are given by their index in the loaded topology, and pairs with atoms missing in the structure are skipped
// Where atoms are in the structure is given as well (see findAtoms)
// Every half of a cylinder is a group with the color of its atom
// The drawn pairs are kept in the shape source data, to tell which one is hovered
// Molstar keeps drawing the buffers of the first geometry, so later frames are built in the previous geometry
export const createAtomPairsShape = (structure, { pairs, atoms, radius = DEFAULT_RADIUS, getColor }, previousCylinders) => {
  const getLocation = atomIndex => {
    const atom = atoms.get(atomIndex);
    const unit = atom && structure.unitMap.get(atom.unitId);
    return unit && StructureElement.Location.create(structure, unit, atom.element);
  };
  const builder = CylindersBuilder.create(pairs.length * 2, 1024, previousCylinders);
  const drawnPairs = [];
  const colors = [];
  const start = Vec3(), end = Vec3(), middle = Vec3();
  for (const pair of pairs) {
    const [location1, location2] = pair.map(getLocation);
    if (!location1 || !location2) continue;
    location1.unit.conformation.position(location1.element, start);
    location2.unit.conformation.position(location2.element, end);
    Vec3.scale(middle, Vec3.add(middle, start, end), 0.5);
    const group = drawnPairs.length * 2;
    // Color mode 2 keeps the color of the group
    builder.add(start[0], start[1], start[2], middle[0], middle[1], middle[2], 1, true, false, 2, group);
    builder.add(middle[0], middle[1], middle[2], end[0], end[1], end[2], 1, false, true, 2, group + 1);
    colors.push(getColor(location1), getColor(location2));
    drawnPairs.push({ locations: [location1, location2], length: Vec3.distance(start, end) });
  }
  return Shape.create(
    ATOM_PAIRS_SHAPE,
    { pairs: drawnPairs },
    builder.getCylinders(),
    group => colors[group],
    () => radius,
    () => 'Distance',
  );
};

// Molstar state node of the links between pairs of atoms of a structure, to be represented with ShapeRepresentation3D
// Links follow their atoms in every frame, since the node is recreated along with its structure
export const AtomPairsShape = CreateTransformer({
  name: 'atom-pairs-shape',
  display: 'Atom pairs',
  from: PluginStateObject.Molecule.Structure,
  to: PluginStateObject.Shape.Provider,
  params: {
    label: PD.Text(''),
    pairs: PD.Value([], { isHidden: true }),
    radius: PD.Numeric(DEFAULT_RADIUS),
    colorTheme: PD.Value({ name: 'uniform', params: {} }, { isHidden: true }),
    alpha: PD.Numeric(1),
  },
})({
  apply({ a, params, cache }, plugin) {
    const structure = a.data;
    // The cache is kept when the node is recreated, so the atoms are found in the first frame only
    if (cache.pairs !== params.pairs) {
      cache.pairs = params.pairs;
      cache.atoms = findAtoms(structure, params.pairs.flat());
    }
    const { name, params: colorParams } = params.colorTheme;
    const theme = plugin.representation.structure.themes.colorThemeRegistry.create(name, { structure }, colorParams);
    const getColor = location => theme.color(location, false);
    return new PluginStateObject.Shape.Provider({
      label: params.label,
      data: { structure, pairs: params.pairs, atoms: cache.atoms, radius: params.radius, getColor },
      params: PD.withDefaults(Cylinders.Params, { alpha: params.alpha }),
      getShape: (ctx, data, props, previousShape) =>
        createAtomPairsShape(data.structure, data, previousShape && previousShape.geometry),
      geometryUtils: Cylinders.Utils,
    }, { label: params.label });
  },
});
