// Helpers to run a real NGL Stage in the tests (jsdom has no WebGL)

// Make canvases return a WebGL context where every call is a harmless no-op
// This is enough for NGL to build its viewer, components and representations
// Returns the 'WEBGL_lose_context' extension mock, used by renderer.forceContextLoss
export const installFakeWebGL = () => {
  const loseContextExtension = { loseContext: vi.fn() };
  const fakeContext = canvas => {
    // GL constants are just distinct numbers, but VERSION strings are parsed by three.js
    const constants = { VERSION: 0x1f02, SHADING_LANGUAGE_VERSION: 0x8b8c };
    const methods = {
      canvas,
      drawingBufferWidth: 1,
      drawingBufferHeight: 1,
      getParameter: p => {
        if (p === constants.VERSION) return 'WebGL 1.0';
        if (p === constants.SHADING_LANGUAGE_VERSION) return 'WebGL GLSL ES 1.0';
        return 16;
      },
      getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
      getExtension: name => name === 'WEBGL_lose_context' ? loseContextExtension : {},
      getSupportedExtensions: () => [],
      getContextAttributes: () => ({ antialias: true }),
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getShaderInfoLog: () => '',
      getProgramInfoLog: () => '',
      isContextLost: () => false,
      checkFramebufferStatus: () => 0x8cd5, // FRAMEBUFFER_COMPLETE
      getActiveAttrib: () => null,
      getActiveUniform: () => null,
    };
    return new Proxy(Object.create(window.WebGLRenderingContext.prototype), {
      get (_, key) {
        if (key in methods) return methods[key];
        if (typeof key === 'string' && /^[A-Z][A-Z0-9_]*$/.test(key)) {
          if (!(key in constants)) constants[key] = 0x10000 + Object.keys(constants).length;
          return constants[key];
        }
        return () => ({});
      },
    });
  };
  // three.js checks contexts against this class, which jsdom does not define
  if (!window.WebGLRenderingContext) window.WebGLRenderingContext = class {};
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(function (type) {
      return /webgl/.test(type) ? fakeContext(this) : null;
    });
  return loseContextExtension;
};

// Replace requestAnimationFrame by a queue which is only run on demand
// This way tests can count the animation frame loops which are alive
export const installFrameQueue = () => {
  let queue = new Map();
  let lastId = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    lastId += 1;
    queue.set(lastId, callback);
    return lastId;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
    queue.delete(id);
  });
  return {
    // Number of callbacks waiting for the next frame
    get pending () { return queue.size; },
    // Run one frame: callbacks requested meanwhile wait for the next one
    runFrame () {
      const current = queue;
      queue = new Map();
      current.forEach(callback => callback(performance.now()));
    },
  };
};

// Format a PDB ATOM/HETATM line
const atomLine = (record, serial, name, resName, chain, resSeq, [x, y, z], element) =>
  record.padEnd(6) +
  String(serial).padStart(5) + ' ' +
  (name.length < 4 ? ` ${name}` : name).padEnd(4) + ' ' +
  resName.padStart(3) + ' ' + chain +
  String(resSeq).padStart(4) + '    ' +
  x.toFixed(3).padStart(8) + y.toFixed(3).padStart(8) + z.toFixed(3).padStart(8) +
  '  1.00  0.00' + ' '.repeat(10) + element.padStart(2);

// A tiny structure: a 2 residue peptide (chain A), a ligand made of 2 bonded residues (chain B) and an ion (chain C)
const TEST_ATOMS = [
  ['ATOM', 'N', 'ALA', 'A', 1, [0, 0, 0], 'N'],
  ['ATOM', 'CA', 'ALA', 'A', 1, [1.46, 0, 0], 'C'],
  ['ATOM', 'C', 'ALA', 'A', 1, [2.0, 1.42, 0], 'C'],
  ['ATOM', 'O', 'ALA', 'A', 1, [1.3, 2.4, 0], 'O'],
  ['ATOM', 'CB', 'ALA', 'A', 1, [2.0, -0.8, 1.2], 'C'],
  ['ATOM', 'H', 'ALA', 'A', 1, [-0.5, 0.8, 0], 'H'],
  ['ATOM', 'N', 'GLY', 'A', 2, [3.3, 1.5, 0], 'N'],
  ['ATOM', 'CA', 'GLY', 'A', 2, [4.0, 2.7, 0], 'C'],
  ['ATOM', 'C', 'GLY', 'A', 2, [5.5, 2.5, 0], 'C'],
  ['ATOM', 'O', 'GLY', 'A', 2, [6.1, 1.5, 0], 'O'],
  ['HETATM', 'C1', 'LIG', 'B', 1, [10, 10, 10], 'C'],
  ['HETATM', 'C2', 'LIG', 'B', 1, [11.5, 10, 10], 'C'],
  ['HETATM', 'O1', 'LIG', 'B', 1, [12.2, 11.1, 10], 'O'],
  ['HETATM', 'C3', 'LIG', 'B', 2, [13.4, 11.5, 10], 'C'],
  ['HETATM', 'NA', 'NA', 'C', 1, [20, 20, 20], 'NA'],
];
export const TEST_ATOM_COORDINATES = TEST_ATOMS.map(atom => atom[5]);
export const TEST_PDB = TEST_ATOMS
  .map(([record, ...fields], index) => atomLine(record, index + 1, ...fields))
  .concat('END', '')
  .join('\n');
