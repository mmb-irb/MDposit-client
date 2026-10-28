import { nglColorToTheme } from '.';

const uniform = value => ({ name: 'uniform', params: { value } });

describe('NGL color to molstar color theme', () => {
  // These are the coloring methods offered in the representations panel
  it('translates the NGL coloring methods', () => {
    expect(nglColorToTheme('chainid')).toEqual({ name: 'chain-id' });
    expect(nglColorToTheme('resname')).toEqual({ name: 'residue-name' });
    expect(nglColorToTheme('element')).toEqual({ name: 'element-symbol' });
    expect(nglColorToTheme('bfactor')).toEqual({ name: 'uncertainty' });
    expect(nglColorToTheme('electrostatic')).toEqual({ name: 'residue-charge' });
    expect(nglColorToTheme('sstruc')).toEqual({ name: 'secondary-structure' });
    // NGL paints uniform in white by default
    expect(nglColorToTheme('uniform')).toEqual(uniform(0xffffff));
  });

  it('paints color names in a uniform color, as NGL does', () => {
    expect(nglColorToTheme('red')).toEqual(uniform(0xff0000));
    expect(nglColorToTheme('green')).toEqual(uniform(0x008000));
    expect(nglColorToTheme('grey')).toEqual(uniform(0x808080));
    expect(nglColorToTheme('lightGrey')).toEqual(uniform(0xd3d3d3));
  });

  it('paints hexadecimal colors in a uniform color', () => {
    expect(nglColorToTheme('#e60000')).toEqual(uniform(0xe60000));
    expect(nglColorToTheme('#0f0')).toEqual(uniform(0x00ff00));
  });

  it('colors by chain when the color is unknown', () => {
    expect(nglColorToTheme('nonsense')).toEqual({ name: 'chain-id' });
    expect(nglColorToTheme(undefined)).toEqual({ name: 'chain-id' });
  });
});
