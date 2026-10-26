import {
  getBilayers,
  getLipidCategoryName,
  getLipidNames,
  getReferenceResidueNames,
} from '.';

describe('getBilayers', () => {
  it('takes membranes with no type as bilayers, as in membrane maps before 0.3.0', () => {
    const bilayer = { leaflets: { top: [0], bot: [1] }, polar_atoms: { top: [0], bot: [1] } };
    expect(getBilayers({ n_mems: 1, mems: { 0: bilayer } })).toEqual([bilayer]);
  });

  it('takes bilayers with lipids in the midplane, as in membrane maps since 0.3.0', () => {
    const bilayer = {
      type: 'bilayer',
      leaflets: { top: [0], bot: [1], midplane: [2] },
      polar_atoms: { top: [0], bot: [1], midplane: [2] },
    };
    expect(getBilayers({ n_mems: 1, mems: { 0: bilayer } })).toEqual([bilayer]);
  });

  it('skips vesicles and micelles, even when they are the first membrane', () => {
    const vesicle = { type: 'vesicle', polar_atoms: { outer: [0], inner: [1], midplane: [] } };
    const micelle = { type: 'micelle', polar_atoms: { outer: [2] } };
    const bilayer = { type: 'bilayer', polar_atoms: { top: [3], bot: [4], midplane: [] } };
    expect(getBilayers({ n_mems: 3, mems: { 0: vesicle, 1: micelle, 2: bilayer } })).toEqual([bilayer]);
    expect(getBilayers({ n_mems: 2, mems: { 0: vesicle, 1: micelle } })).toEqual([]);
  });

  it('returns no bilayers without membrane map', () => {
    expect(getBilayers(null)).toEqual([]);
    expect(getBilayers(undefined)).toEqual([]);
  });
});

describe('getLipidCategoryName', () => {
  it('names the LIPID MAPS category of lipids', () => {
    expect(getLipidCategoryName({ lipid: { category: 'GP', forced: false } })).toBe('Glycerophospholipids');
    expect(getLipidCategoryName({ lipid: { category: 'ST', forced: true } })).toBe('Sterol lipids');
  });

  it('returns null for non lipids, lipids with no category and references before the classification', () => {
    expect(getLipidCategoryName({ lipid: null })).toBeNull();
    expect(getLipidCategoryName({ lipid: { category: null, forced: true } })).toBeNull();
    expect(getLipidCategoryName({ swisslipids: null, lipidmaps: null })).toBeNull();
    expect(getLipidCategoryName(undefined)).toBeNull();
  });
});

describe('getLipidNames', () => {
  const POPC_KEY = 'WTJKGGKOPKCXLL-VYOBOKEXSA-N';
  const MC3_KEY = 'NRLNQCOGCKAESA-KWXKLSQISA-N';

  it('names coarse grain lipids, which have no reference, after their key', () => {
    expect(getLipidNames('POPC', undefined)).toEqual({ name: 'POPC', shortName: 'POPC', longName: 'POPC' });
  });

  it('prefers LIPID MAPS names', () => {
    const reference = {
      inchikey: POPC_KEY,
      lipidmaps: { name: 'PC(16:0/18:1(9Z))', synonyms: '1-palmitoyl-2-oleoyl-PC; POPC', sys_name: 'long name' },
      swisslipids: { entity_name: 'swiss name', synonyms: [{ name: 'swiss', type: 'abbreviation' }] },
    };
    expect(getLipidNames(POPC_KEY, reference, 'POPC')).toEqual(
      { name: 'PC(16:0/18:1(9Z))', shortName: 'POPC', longName: 'long name' });
  });

  it('uses SwissLipids when LIPID MAPS is missing (false in old references, null in new ones)', () => {
    for (const lipidmaps of [false, null]) {
      const reference = {
        inchikey: POPC_KEY,
        lipidmaps,
        swisslipids: { entity_name: 'swiss name', synonyms: [{ name: 'swiss', type: 'abbreviation' }] },
      };
      expect(getLipidNames(POPC_KEY, reference, 'POPC')).toEqual(
        { name: 'swiss', shortName: 'swiss', longName: 'swiss name' });
    }
  });

  it('uses the SwissLipids entity name when it has no abbreviation', () => {
    const reference = {
      inchikey: POPC_KEY,
      lipidmaps: null,
      swisslipids: { entity_name: 'swiss name', synonyms: [{ name: 'other', type: 'synonym' }] },
    };
    expect(getLipidNames(POPC_KEY, reference)).toEqual(
      { name: 'swiss name', shortName: 'swiss name', longName: 'swiss name' });
  });

  it('names lipids missing in the lipid databases after their residues and category', () => {
    const reference = { inchikey: MC3_KEY, swisslipids: null, lipidmaps: null, lipid: { category: 'FA', forced: false } };
    expect(getLipidNames(MC3_KEY, reference, 'MC3')).toEqual(
      { name: 'MC3', shortName: 'Fatty acyls', longName: 'MC3' });
    // The ligand name is a better long name
    const withLigand = { ...reference, ligand: { name: 'Dlin-MC3-DMA' } };
    expect(getLipidNames(MC3_KEY, withLigand, 'MC3').longName).toBe('Dlin-MC3-DMA');
  });

  it('names lipids with no names at all after their InChI key', () => {
    const reference = { inchikey: MC3_KEY, swisslipids: null, lipidmaps: null };
    expect(getLipidNames(MC3_KEY, reference, null)).toEqual(
      { name: MC3_KEY, shortName: MC3_KEY, longName: MC3_KEY });
  });
});

describe('getReferenceResidueNames', () => {
  const topology = {
    residueNames: ['GAL', 'CER', 'GAL', 'CER', 'SOL'],
    getReferenceResidueIndices: reference => ({ GALCER: [0, 1, 2, 3] })[reference],
  };

  it('joins the unique residue names of a reference', () => {
    expect(getReferenceResidueNames(topology, 'GALCER')).toBe('CER, GAL');
  });

  it('returns null without residues or topology', () => {
    expect(getReferenceResidueNames(topology, 'MISSING')).toBeNull();
    expect(getReferenceResidueNames(undefined, 'GALCER')).toBeNull();
  });
});
