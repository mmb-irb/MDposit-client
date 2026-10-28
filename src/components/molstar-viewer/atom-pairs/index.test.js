import { parsePDB } from 'molstar/lib/mol-io/reader/pdb/parser';
import { trajectoryFromPDB } from 'molstar/lib/mol-model-formats/structure/pdb';
import { Structure, StructureProperties } from 'molstar/lib/mol-model/structure';
import { OrderedSet } from 'molstar/lib/mol-data/int';

import { createAtomPairsShape } from '.';
import { getHoveredAtomPair } from '../hovered-atoms';
import { TEST_PDB, TEST_ATOM_COORDINATES } from '../../ngl-viewer/test-utils';

const getStructure = async () => {
  const parsed = await parsePDB(TEST_PDB).run();
  const trajectory = await trajectoryFromPDB(parsed.result).run();
  return Structure.ofModel(trajectory.representative);
};

// Color every atom by its index, to tell which atom gave the color
const getColor = location => StructureProperties.atom.sourceIndex(location);

describe('createAtomPairsShape', () => {
  it('draws a link between the atoms of every pair, each half colored as its atom', async () => {
    const structure = await getStructure();
    // The alanine CA to the glycine CA, and the ligand C1 to the ion
    const shape = createAtomPairsShape(structure, { pairs: [[1, 7], [10, 14]], radius: 0.1, getColor });
    expect(shape.geometry.cylinderCount).toBe(4);
    expect([0, 1, 2, 3].map(group => shape.getColor(group, 0))).toEqual([1, 7, 10, 14]);
    expect(shape.getSize(0, 0)).toBe(0.1);
    // The second link goes from (10, 10, 10) to (20, 20, 20)
    const [length] = shape.sourceData.pairs.slice(1).map(pair => pair.length);
    expect(length).toBeCloseTo(Math.sqrt(300));
    // Both halves of the first link meet in the middle of its atoms
    const { startBuffer, endBuffer } = shape.geometry;
    // The builder writes 6 vertices per cylinder
    const verticesPerCylinder = 6;
    const getPoint = (buffer, cylinder) =>
      Array.from(buffer.ref.value.slice(cylinder * verticesPerCylinder * 3, cylinder * verticesPerCylinder * 3 + 3));
    const [start, end] = [TEST_ATOM_COORDINATES[1], TEST_ATOM_COORDINATES[7]];
    const middle = start.map((value, axis) => (value + end[axis]) / 2);
    expect(getPoint(startBuffer, 0)).toEqual(start.map(Math.fround));
    expect(getPoint(endBuffer, 0).map(v => v.toFixed(3))).toEqual(middle.map(v => v.toFixed(3)));
    expect(getPoint(startBuffer, 1).map(v => v.toFixed(3))).toEqual(middle.map(v => v.toFixed(3)));
    expect(getPoint(endBuffer, 1)).toEqual(end.map(Math.fround));
  });

  // Molstar keeps drawing the buffers of the first geometry, so new frames must be written in them
  it('draws new positions in the geometry of the previous links', async () => {
    const structure = await getStructure();
    const previous = createAtomPairsShape(structure, { pairs: [[1, 7]], getColor });
    const startBuffer = previous.geometry.startBuffer;
    // The same structure with every atom 10 Å further along X, as in another frame
    const { x } = structure.model.atomicConformation;
    for (let i = 0; i < x.length; i++) x[i] += 10;
    const moved = Structure.ofModel(structure.model);
    const shape = createAtomPairsShape(moved, { pairs: [[1, 7]], getColor }, previous.geometry);
    expect(shape.geometry.startBuffer).toBe(startBuffer);
    expect(startBuffer.ref.value[0]).toBeCloseTo(11.46);
  });

  it('skips pairs with atoms which are not in the structure', async () => {
    const structure = await getStructure();
    const shape = createAtomPairsShape(structure, { pairs: [[1, 7], [1, 1000]], getColor });
    expect(shape.sourceData.pairs).toHaveLength(1);
    expect(shape.geometry.cylinderCount).toBe(2);
  });

  it('tells which pair is hovered, from either half of its link', async () => {
    const structure = await getStructure();
    const shape = createAtomPairsShape(structure, { pairs: [[1, 7], [10, 14]], getColor });
    const hover = group => getHoveredAtomPair({ kind: 'group-loci', shape, groups: [{ ids: OrderedSet.ofSingleton(group), instance: 0 }] });
    expect(hover(3).atoms.map(atom => [atom.index, atom.name, atom.residueName])).toEqual([
      [10, 'C1', 'LIG'], [14, 'NA', 'NA'],
    ]);
    expect(hover(2).length).toBeCloseTo(Math.sqrt(300));
    expect(hover(0).atoms.map(atom => atom.index)).toEqual([1, 7]);
  });
});
