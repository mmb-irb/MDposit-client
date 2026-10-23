// Lipids in the membrane map and the InChI key references from the MDDB workflow
import { unique } from 'src/utils/auxiliar-functions';

// Membrane map aggregate type with top and bottom leaflets
// Membrane maps before version 0.3.0 have no type and only flat bilayers
// Newer maps also have vesicles (outer, inner and midplane leaflets) and micelles (outer leaflet)
const BILAYER = 'bilayer';

// Get the flat bilayers of a membrane map, which are the only aggregates with planar analyses (e.g. thickness)
export const getBilayers = membraneMap => {
  if (!membraneMap || !membraneMap.mems) return [];
  return Object.values(membraneMap.mems).filter(mem => (mem.type || BILAYER) === BILAYER);
};

// LIPID MAPS categories, as the workflow classifies lipids
export const LIPID_CATEGORY_NAMES = {
  FA: 'Fatty acyls',
  GL: 'Glycerolipids',
  GP: 'Glycerophospholipids',
  SP: 'Sphingolipids',
  ST: 'Sterol lipids',
  PR: 'Prenol lipids',
  SL: 'Saccharolipids',
  PK: 'Polyketides',
};

// Get the LIPID MAPS category name of an InChI key reference
// Only lipids have a category, and references made before the lipid classification have none
export const getLipidCategoryName = reference => {
  const category = reference && reference.lipid && reference.lipid.category;
  if (!category) return null;
  return LIPID_CATEGORY_NAMES[category] || category;
};

// Get the residue names of a reference in the topology, e.g. 'MC3', or several for glycolipids
export const getReferenceResidueNames = (topology, referenceId) => {
  const residueIndices = topology && topology.getReferenceResidueIndices(referenceId);
  if (!residueIndices || residueIndices.length === 0) return null;
  return unique(residueIndices.map(residueIndex => topology.residueNames[residueIndex])).sort().join(', ');
};

// Get the names of a lipid in the lipid analyses: { name, shortName, longName }
// The lipid is the analysis key: an InChI key, or a residue name in coarse grain simulations
// Lipids missing in LIPID MAPS and SwissLipids (e.g. synthetic lipids like MC3) have null database
// references, so they are named after their residues and the short name is their category, if any
export const getLipidNames = (lipid, reference, residueNames) => {
  // Coarse grain lipids have no reference
  if (!reference) return { name: lipid, shortName: lipid, longName: lipid };
  // Database references may be null, or false in old references
  const { lipidmaps, swisslipids, ligand } = reference;
  if (lipidmaps && lipidmaps.synonyms) return {
    name: lipidmaps.name,
    shortName: lipidmaps.synonyms.split('; ').sort((a, b) => a.length - b.length)[0],
    longName: lipidmaps.sys_name,
  };
  if (swisslipids && swisslipids.synonyms) {
    // Some SwissLipids entities have no abbreviation
    const abbreviation = swisslipids.synonyms.find(synonym => synonym.type === 'abbreviation');
    const name = abbreviation ? abbreviation.name : swisslipids.entity_name;
    return { name, shortName: name, longName: swisslipids.entity_name };
  }
  const name = residueNames || lipid;
  const longName = (lipidmaps && lipidmaps.name) || (swisslipids && swisslipids.entity_name)
    || (ligand && ligand.name) || name;
  return { name, shortName: getLipidCategoryName(reference) || name, longName };
};
