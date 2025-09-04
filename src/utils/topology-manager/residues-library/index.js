// Set a library of residues useful for topology handling

// Amino acids
export const PROTEIN_RESIDUE_NAME_LETTERS = {
    'ALA':'A',
    'ALAN':'A',
    'ALAC':'A',
    'ARG':'R',
    'ARGN':'R',
    'ARGC':'R',
    'ASN':'N',
    'ASNN':'N',
    'ASNC':'N',
    'ASP':'D',
    'ASPN':'D',
    'ASPC':'D',
    'CYS':'C',
    'CYSN':'C',
    'CYSC':'C',
    'CYH':'C',
    'CSH':'C',
    'CSS':'C',
    'CYX':'C',
    'CYP':'C',
    'GLN':'Q',
    'GLNN':'Q',
    'GLNC':'Q',
    'GLU':'E',
    'GLUN':'E',
    'GLUC':'E',
    'GLUP':'E',
    'GLY':'G',
    'GLYN':'G',
    'GLYC':'G',
    'HIS':'H',
    'HISN':'H',
    'HISC':'H',
    'HID':'H',
    'HIE':'H',
    'HIP':'H',
    'HSD':'H',
    'HSE':'H',
    'ILE':'I',
    'ILEN':'I',
    'ILEC':'I',
    'ILU':'I',
    'LEU':'L',
    'LEUN':'L',
    'LEUC':'L',
    'LYS':'K',
    'LYSN':'K',
    'LYSC':'K',
    'MET':'M',
    'METN':'M',
    'METC':'M',
    'PHE':'F',
    'PHEN':'F',
    'PHEC':'F',
    'PRO':'P',
    'PRON':'P',
    'PROC':'P',
    'PRØ':'P',
    'PR0':'P',
    'PRZ':'P',
    'SER':'S',
    'SERN':'S',
    'SERC':'S',
    'THR':'T',
    'THRN':'T',
    'THRC':'R',
    'TRP':'W',
    'TRPN':'W',
    'TRPC':'W',
    'TRY':'W',
    'TYR':'Y',
    'TYRN':'Y',
    'TYRC':'Y',
    'VAL':'V',
    'VALN':'V',
    'VALC':'V',
};
// Nucleotides
export const DNA_RESIDUE_NAME_LETTERS = {
    'DA': 'A',
    'T': 'T',
    'T3': 'T',
    'T5': 'T',
    'DT': 'T',
    'DC': 'C',
    'DG': 'G',
    'DA3': 'A',
    'DA5': 'A',
    'DT3': 'T',
    'DT5': 'T',
    'DC3': 'C',
    'DC5': 'C',
    'DG3': 'G',
    'DG5': 'G',
};
export const RNA_RESIDUE_NAME_LETTERS = {
    'RA': 'A',
    'U': 'U',
    'U3': 'U',
    'U5': 'U',
    'RU': 'U',
    'RC': 'C',
    'RG': 'G',
    'RA3': 'A',
    'RA5': 'A',
    'RU3': 'U',
    'RU5': 'U',
    'RC3': 'C',
    'RC5': 'C',
    'RG3': 'G',
    'RG5': 'G',
};
export const NUCLEIC_RESIDUE_NAME_LETTERS = {
    ...DNA_RESIDUE_NAME_LETTERS,
    ...RNA_RESIDUE_NAME_LETTERS,
    'A': 'A',
    'A3': 'A',
    'A5': 'A',
    'C': 'C',
    'C3': 'C',
    'C5': 'C',
    'G': 'G',
    'G3': 'G',
    'G5': 'G',
};
// All of them together
export const RESIDUE_NAME_LETTERS = {
    ...PROTEIN_RESIDUE_NAME_LETTERS,
    ...NUCLEIC_RESIDUE_NAME_LETTERS
};

// Lipid common residue names
// https://github.com/molstar/molstar/blob/master/src/mol-model/structure/model/types/lipids.ts
// Source: https://github.com/NMRLipids/Databank/blob/main/Scripts/DatabankLib/settings/molecules.py#L10
// Meanings: https://github.com/NMRLipids/Databank/blob/48fdf2c4149d0db8900ce08b0e74dc1836dcfab3/Scripts/BuildDatabank/docs/source/moleculesAndMapping.md?plain=1#L50
export const FATTY_RESIDUE_NAMES = new Set([
    'ANE5', 'APC', 'BNSM', 'BOG', 'CER', 'CER180', 'CER1', 'CER2', 'CPC', 'DAPA', 'DAPC', 'DAPE',
    'DAPG', 'DAPS', 'DBPA', 'DBPC', 'DBPE', 'DBPG', 'DBPS', 'DBSM', 'DDOPC',
    'DEPC', 'DFPA', 'DFPC', 'DFPE', 'DFPG', 'DFPS', 'DGPA', 'DGPC', 'DGPE',
    'DGPG', 'DGPS', 'DHMDMAB', 'DIPA', 'DIPC', 'DIPE', 'DIPG', 'DIPS', 'DLIPC',
    'DLPA', 'DLPC', 'DLPE', 'DLPG', 'DLPS', 'DMPC', 'DMTAP', 'DNPA', 'DNPC',
    'DNPE', 'DNPG', 'DNPS', 'DOG', 'DOPA', 'DOPC', 'DOPE', 'DOPG', 'DOPS',
    'DPCE', 'DPP', 'DPPA', 'DPPC', 'DPPE', 'DPPG', 'DPPGK', 'DPPI', 'DPPS',
    'DPSM', 'DRPA', 'DRPC', 'DRPE', 'DRPG', 'DRPS', 'DSPC', 'DTPA', 'DTPC',
    'DTPE', 'DTPG', 'DTPS', 'DUPE', 'DUPS', 'DVPA', 'DVPC', 'DVPE', 'DVPG',
    'DVPS', 'DXCE', 'DXPA', 'DXPC', 'DXPE', 'DXPG', 'DXPS', 'DXSM', 'DYPA',
    'DYPC', 'DYPE', 'DYPG', 'DYPS', 'GB3', 'GM1', 'IPC', 'LPC', 'LLPE', 'LPPA', 'LPPC',
    'LPPE', 'LPPG', 'LPPS', 'NSM', 'OPC', 'PADG', 'PAPA', 'PAPC', 'PAPE', 'PAPG',
    'PAPI', 'PAPS', 'PAzePCdeprot', 'PAzePCprot', 'PEPC', 'PGPA', 'PGPC',
    'PGPE', 'PGPG', 'PGPS', 'PGSM', 'PIDG', 'PIPA', 'PIPC', 'PIPE', 'PIPG',
    'PIPI', 'PIPS', 'PLPS', 'PNCE', 'PNSM', 'PODG', 'POP', 'POPA', 'POPC', 'POPE',
    'POPG', 'POPI', 'POPS', 'POSM', 'PPC', 'PQPE', 'PQPS', 'PRPA', 'PRPC',
    'PRPE', 'PRPG', 'PRPS', 'PUDG', 'PUPA', 'PUPC', 'PUPE', 'PUPI', 'PUPS',
    'PVDG', 'PVP', 'PVPI', 'PVSM', 'PYPC', 'SAPI', 'SAPI24', 'SAPI25', 'SDG',
    'SDPE', 'SLPI', 'SLiPC', 'SM16', 'SM18', 'SOPC', 'SSM', 'TLCL_0H', 'TMCL', 'TOCL',
    'TPC', 'UPC', 'VPC', 'XNCE', 'XNSM']);
export const STEROID_RESIDUE_NAMES = new Set([ "CHL", "CHL1", "CHOL", "DCHOL" ]);

// Set typical residue names to guess what residues are
export const STANDARD_SOLVENT_RESIDUE_NAMES = new Set([ 'SOL', 'WAT', 'HOH', 'TIP', 'TP3', 'SWM4' ]);
// WARNING: Note that standard names also include + and - symbols
// Use functions such as Structure.select_counter_ions instead of checking if the set includes a name
export const STANDARD_COUNTER_CATION_ATOM_NAMES = new Set([ 'K', 'NA', 'SOD', 'POT' ]);
export const STANDARD_COUNTER_ANION_ATOM_NAMES = new Set([ 'CL', 'CLA' ]);
export const STANDARD_COUNTER_ION_ATOM_NAMES = STANDARD_COUNTER_CATION_ATOM_NAMES.union(STANDARD_COUNTER_ANION_ATOM_NAMES)
export const STANDARD_DUMMY_ATOM_NAMES = new Set([ 'MW' ]);
export const DUMMY_ATOM_ELEMENT = 'Dm'
export const CG_ATOM_ELEMENT = 'Cg'