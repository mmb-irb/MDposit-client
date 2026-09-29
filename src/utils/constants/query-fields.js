export default {
    "System": [
        {
            "name": "Keywords",
            "path": "metadata.SYSKEYS",
            "type": "string",
            "example": "protein",
            "options": true,
            "checkbox" : true,
            "defaultOpen": true,
        },
        {
            "name": "Interactions",
            "path": "metadata.INTERACTIONS.type",
            "type": "string",
            "example": "protein-protein",
            "options": true,
            "checkbox" : true
        },
        {
            "name": "System atom count",
            "path": "metadata.SYSTATS",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "System residue count",
            "path": "metadata.SYSTRES",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "Protein atom count",
            "path": "metadata.PROTATS",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "Protein residue count",
            "path": "metadata.PROTRES",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "DNA atom count",
            "path": "metadata.DNAATS",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "DNA residue count",
            "path": "metadata.DNARES",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "RNA atom count",
            "path": "metadata.RNAATS",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "RNA residue count",
            "path": "metadata.RNARES",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "Lipid atom count",
            "path": "metadata.LIPIATS",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "Lipid residue count",
            "path": "metadata.LIPIRES",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "Carbohydrates atom count",
            "path": "metadata.CARBATS",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "Carbohydrates residue count",
            "path": "metadata.CARBRES",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "Solvent atom count",
            "path": "metadata.SOLVATS",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "Solvent residue count",
            "path": "metadata.SOLVRES",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "Counter cation count",
            "path": "metadata.COUNCAT",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "Counter anion count",
            "path": "metadata.COUNANI",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "Counter ion count",
            "path": "metadata.COUNION",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "Non-counter ion count",
            "path": "metadata.NOCNION",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "Other atom count",
            "path": "metadata.OTHRATS",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
    ],
    "Features": [
        {
            "name": "Protein sequence",
            "path": "metadata.PROTSEQ",
            "type": "string",
            "example": "VNLTTRT",
            "options": false
        },
        {
            "name": "Nucleic acid sequences",
            "path": "metadata.NUCLSEQ",
            "type": "string",
            "example": "CGCGAATTCGCG",
            "options": false
        },
        {
            "name": "Domains",
            "path": "metadata.DOMAINS",
            "type": "string",
            "example": "Receptor-binding domain (RBD)",
            "options": true
        },
        {
            "name": "Post translational modifications",
            "path": "metadata.PTM",
            "type": "string",
            "example": "Glycosylation",
            "options": true
        },
        {
            "name": "Multimeric form",
            "path": "metadata.MULTIMERIC",
            "type": "string",
            "example": "Dimer",
            "options": true,
            "checkbox" : true
        } 
    ],
    "References": [
        {
            "name": "PDB id",
            "path": "metadata.PDBIDS",
            "type": "string",
            "example": "12CA",
            "options": true,
        },
        {
            "name": "PDB title",
            "path": "references.pdbs.title",
            "type": "string",
            "example": "kinetics of human carbonic anhydrase",
        },
        {
            "name": "PDB classification",
            "path": "references.pdbs.class",
            "type": "string",
            "example": "acid",
            "options": true,
        },
        {
            "name": "PDB authors",
            "path": "references.pdbs.authors",
            "type": "string",
            "example": "CHRISTIANSON",
            "options": true,
        },
        {
            "name": "PDB organism",
            "path": "references.pdbs.organisms",
            "type": "string",
            "example": "Homo sapiens",
            "options": true,
        },
        {
            "name": "PDB method",
            "path": "references.pdbs.method",
            "type": "string",
            "example": "X-RAY DIFFRACTION",
            "options": true,
        },
        {
            "name": "PDB resolution",
            "path": "references.pdbs.resolution",
            "type": "float",
            "example": "2.4",
        },
        {
            "name": "Ligand name",
            "path": "references.inchikeys.ligand.name",
            "type": "string",
            "example": "aclidinium",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "Ligand PubChem id",
            "path": "references.inchikeys.ligand.pubchem",
            "type": "string",
            "example": "1986",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "Ligand DrugBank id",
            "path": "references.inchikeys.ligand.drugbank",
            "type": "string",
            "example": "DB09330",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "Ligand ChEMBL id",
            "path": "references.inchikeys.ligand.chembl",
            "type": "string",
            "example": "CHEMBL14830",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "Ligand PDB code",
            "path": "references.inchikeys.ligand.pdbid",
            "type": "string",
            "example": "HEM",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "InChI key",
            "path": "metadata.INCHIKEYS",
            "type": "string",
            "example": "HVYWMOMLDIMFJA-DPAQBDIFSA-N",
            "options": true,
        },
        {
            "name": "Uniprot id",
            "path": "metadata.REFERENCES",
            "type": "string",
            "example": "Q9BYF1",
            "options": true
        },
        {
            "name": "Uniprot organism",
            "path": "references.proteins.organism",
            "type": "string",
            "example": "Homo sapiens",
            "options": true
        },
        {
            "name": "Uniprot gene",
            "path": "references.proteins.gene",
            "type": "string",
            "example": "ACE2",
            "options": true
        },
        {
            "name": "Uniprot name",
            "path": "references.proteins.name",
            "type": "string",
            "example": "Angiotensin-converting enzyme 2",
            "options": true
        },
        {
            "name": "Uniprot protein function",
            "path": "references.proteins.functions",
            "type": "string",
            "example": "RNA binding",
            "options": true
        }
    ],
    "Molecular Dynamics": [
        {
            "name": "Type",
            "path": "metadata.TYPE",
            "type": "string",
            "example": "ensemble",
            "options": true,
            "checkbox" : true
        },
        {
            "name": "Program",
            "path": "metadata.PROGRAM",
            "type": "string",
            "example": "Gromacs",
            "options": true,
            "checkbox" : true
        },
        {
            "name": "MD method",
            "path": "metadata.METHOD",
            "type": "string",
            "example": "Classical MD",
            "options": true,
            "checkbox" : true
        },
        {
            "name": "Ensemble",
            "path": "metadata.ENSEMBLE",
            "type": "string",
            "example": "NPT",
            "options": true,
            "checkbox" : true
        },
        {
            "name": "Temperature (K)",
            "path": "metadata.TEMP",
            "type": "float",
            "example": "300",
            "options": true,
            "checkbox" : true
        },
        {
            "name": "Force field",
            "path": "metadata.FF",
            "type": "string",
            "example": "CHARMM36m",
            "options": true,
            "checkbox" : true
        },
        {
            "name": "Water type",
            "path": "metadata.WAT",
            "type": "string",
            "example": "TIP3",
            "options": true,
            "checkbox" : true
        },
        {
            "name": "Boxtype",
            "path": "metadata.BOXTYPE",
            "type": "string",
            "example": "Triclinic",
            "options": true,
            "checkbox" : true
        },
        {
            "name": "Timestep (fs)",
            "path": "metadata.TIMESTEP",
            "type": "float",
            "example": "2",
            "options": true,
            "checkbox" : true
        },
        {
            "name": "Framestep (ns)",
            "path": "metadata.FRAMESTEP",
            "type": "float",
            "example": "any number",
            "options": false
        },
        {
            "name": "Number of frames",
            "path": "mds.frames",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "Simulation time (ns)",
            "path": "mds.time",
            "type": "float",
            "example": "any number",
            "options": false
        },
    ],
    "Topology": [
        {
            "name": "Chain names",
            "path": "metadata.CHNAME",
            "type": "string",
            "example": "M",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "Residue names",
            "path": "metadata.RSNAME",
            "type": "string",
            "example": "NME",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "Atom names",
            "path": "metadata.ATNAME",
            "type": "string",
            "example": "OT1",
            "options": false, // Asking for options would make de request way slower
            "checkbox" : false
        },
        {
            "name": "Atom elements",
            "path": "metadata.ATELEM",
            "type": "string",
            "example": "Zn",
            "options": false, // Asking for options would make de request way slower
            "checkbox" : false
        },
    ],
        "General annotations": [
        {
            "name": "Name",
            "path": "metadata.NAME",
            "type": "string",
            "example": "spike opening ...",
            "options": false
        },
        {
            "name": "Description",
            "path": "metadata.DESCRIPTION",
            "type": "string",
            "example": "this simulation ...",
            "options": false
        },
        {
            "name": "Authors",
            "path": "metadata.AUTHORS",
            "type": "string",
            "example": "Modesto Orozco",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "Groups",
            "path": "metadata.GROUPS",
            "type": "string",
            "example": "IRB Barcelona, Orozco lab",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "Citation",
            "path": "metadata.CITATION",
            "type": "string",
            "example": "institute of ...",
            "options": false
        },
        {
            "name": "Collections",
            "path": "metadata.COLLECTIONS",
            "type": "string",
            "example": "cv19",
            "options": true,
            "checkbox": true,
        },
    ],
    "Other": [
        {
            "name": "Mean global RMSD (Å)",
            "path": "mds.rmsd_mean",
            "type": "float",
            "example": "any number",
            "options": false,
            "experimental": true,
        },
        {
            "name": "Standard deviation of global RMSD (Å)",
            "path": "mds.rmsd_stdv",
            "type": "float",
            "example": "any number",
            "options": false,
            "experimental": true,
        },
        {
            "name": "Maximum global RMSD (Å)",
            "path": "mds.rmsd_max",
            "type": "float",
            "example": "any number",
            "options": false,
            "experimental": true,
        },
        {
            "name": "Available MD analyses",
            "path": "mds.analyses.name",
            "type": "string",
            "example": "pca",
            "options": true,
        },
        {
            "name": "Project files",
            "path": "files.name",
            "type": "string",
            "example": "topology.tpr",
            "options": true
        },
        {
            "name": "MD files",
            "path": "mds.files.name",
            "type": "string",
            "example": "pocket_10.pdb",
            "options": true
        },
        {
            "name": "Number of MDs",
            "path": "mdcount",
            "type": "int",
            "example": "any integer number",
            "options": false
        },
        {
            "name": "Last update date",
            "path": "updateDate",
            "type": "date",
            "example": "any date",
            "options": false
        },
        {
            "name": "Creation date",
            "path": "creationDate",
            "type": "date",
            "example": "any date",
            "options": false,
            // Render a warning for the user to know thies field is not fully confident
            "experimental": true,
        },
    ]
};