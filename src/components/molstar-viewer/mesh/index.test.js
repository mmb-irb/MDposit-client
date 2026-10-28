import { createMeshShape } from '.';

// Two triangles, as a flat list of vertex coordinates
const position = [
  0, 0, 0, 1, 0, 0, 0, 1, 0,
  0, 0, 1, 1, 0, 1, 0, 1, 1,
];

describe('createMeshShape', () => {
  it('makes a triangle of every 3 vertices, with the color of every vertex', () => {
    const colorData = [
      1, 0, 0, 1, 0, 0, 1, 0, 0,
      0, 0, 1, 0, 0, 1, 0, 0, 1,
    ];
    const shape = createMeshShape({ name: 'channel', position, colorData, normalsData: null });
    expect(shape.name).toBe('channel');
    expect(shape.geometry.vertexCount).toBe(6);
    expect(shape.geometry.triangleCount).toBe(2);
    expect(shape.groupCount).toBe(6);
    expect([0, 2, 3, 5].map(group => shape.getColor(group, 0))).toEqual([0xff0000, 0xff0000, 0x0000ff, 0x0000ff]);
  });

  it('computes the normals when they are not given', () => {
    const shape = createMeshShape({ name: 'channel', position, colorData: null, normalsData: null });
    // Both triangles lie on XY planes
    const normals = Array.from(shape.geometry.normalBuffer.ref.value);
    for (let vertex = 0; vertex < 6; vertex++) {
      expect(normals.slice(vertex * 3, vertex * 3 + 3).map(Math.abs)).toEqual([0, 0, 1]);
    }
  });
});
