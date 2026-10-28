import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { Mesh } from 'molstar/lib/mol-geo/geometry/mesh/mesh';
import { Shape } from 'molstar/lib/mol-model/shape';
import { Color } from 'molstar/lib/mol-util/color';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';

import { CreateTransformer } from '../molstar-parser';
import { getMeshColors } from '../../../utils/mesh-colors';

// Build a molstar shape of a mesh given as the NGL viewer draws it (see drawMesh in the NGL viewer)
// Every 3 vertices make a triangle
// Every vertex is a group with its own color, so colors blend across triangles as in NGL
export const createMeshShape = ({ name, position, colorData, normalsData }) => {
  const vertexCount = Math.floor(position.length / 3);
  const triangleCount = Math.floor(vertexCount / 3);
  const indices = new Uint32Array(triangleCount * 3).map((v, i) => i);
  const groups = new Float32Array(vertexCount).map((v, i) => i);
  const hasNormals = Array.isArray(normalsData) && normalsData.length === position.length;
  const normals = hasNormals ? new Float32Array(normalsData) : new Float32Array(vertexCount * 3);
  const mesh = Mesh.create(new Float32Array(position), indices, normals, groups, vertexCount, triangleCount);
  if (!hasNormals) Mesh.computeNormals(mesh);
  const colors = getMeshColors(position, colorData);
  const getColor = group => Color.fromNormalizedRgb(colors[group * 3], colors[group * 3 + 1], colors[group * 3 + 2]);
  return Shape.create(name, null, mesh, getColor, () => 1, () => name);
};

// Molstar state node of a mesh, to be represented with ShapeRepresentation3D
export const MeshShape = CreateTransformer({
  name: 'mesh-shape',
  display: 'Mesh',
  from: PluginStateObject.Root,
  to: PluginStateObject.Shape.Provider,
  params: {
    name: PD.Text(''),
    position: PD.Value([], { isHidden: true }),
    colorData: PD.Value(null, { isHidden: true }),
    normalsData: PD.Value(null, { isHidden: true }),
  },
})({
  apply({ params }) {
    return new PluginStateObject.Shape.Provider({
      label: params.name,
      data: params,
      // NGL draws both sides of meshes
      params: PD.withDefaults(Mesh.Params, { doubleSided: true }),
      getShape: (ctx, data) => createMeshShape(data),
      geometryUtils: Mesh.Utils,
    }, { label: params.name });
  },
});
