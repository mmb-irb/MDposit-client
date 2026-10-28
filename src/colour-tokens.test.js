import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// Colours in the CSS must come from the theme tokens (the --mui-* variables written by the
// MUI theme in src/App), so host branding and colour schemes reach every page

// import.meta.url is not a file URL under jsdom, but Vitest provides __dirname
const srcDir = __dirname;

// Files which keep their own colours on purpose
const ALLOWED_FILES = [
  // 3D viewer internals (canvas backgrounds and status labels)
  'components/ngl-viewer/style.module.css',
  'components/molstar-viewer/style.module.css',
  // Chart series colours, which are data rather than UI
  'components/eigenvalue-graph/style.module.css',
  'components/histogram/style.module.css',
];
// Shadows go away with the outlined cards, so they are left as they are until then
const ALLOWED_PROPERTIES = ['box-shadow'];

const NAMED_COLOURS = [
  'white', 'black', 'grey', 'gray', 'silver', 'red', 'green', 'blue', 'orange', 'purple',
  'lightgrey', 'lightgray', 'darkgrey', 'darkgray', 'dimgrey', 'dimgray', 'whitesmoke', 'gainsboro',
];
const COLOUR = new RegExp(
  [
    '#[0-9a-f]{3,8}\\b',
    // Allowed when they only add an alpha to a token channel, e.g. rgba(var(--x-mainChannel) / 0.2)
    '(?:rgb|hsl)a?\\((?!\\s*var\\()',
    // Not when part of a variable name, e.g. --mui-palette-common-white
    `(?<![\\w-])(?:${NAMED_COLOURS.join('|')})(?![\\w-])`,
  ].join('|'),
  'i',
);

// Find every colour literal in a stylesheet, as 'line: declaration'
const findColours = css =>
  css
    // Blank out comments but keep the line count
    .replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter(({ text }) => {
      const declaration = text.match(/^([a-z-]+)\s*:(.*)$/i);
      if (!declaration) return false;
      const [, property, value] = declaration;
      return !ALLOWED_PROPERTIES.includes(property) && COLOUR.test(value);
    })
    .map(({ line, text }) => `${line}: ${text}`);

const cssFiles = readdirSync(srcDir, { recursive: true })
  .filter(file => file.endsWith('.css'))
  .map(file => relative(srcDir, join(srcDir, file)).replaceAll('\\', '/'))
  .filter(file => !ALLOWED_FILES.includes(file))
  .sort();

describe('colour tokens', () => {
  it('finds the stylesheets', () => {
    expect(cssFiles.length).toBeGreaterThan(50);
  });

  it.each(cssFiles)('%s uses theme tokens instead of colour literals', file => {
    const css = readFileSync(join(srcDir, file), 'utf8');
    expect(findColours(css)).toEqual([]);
  });
});
