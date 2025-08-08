export default {
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
            "path": "references.ligands.name",
            "type": "string",
            "example": "aclidinium",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "Ligand PubChem id",
            "path": "metadata.LIGANDS",
            "type": "string",
            "example": "1986",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "Ligand DrugBank id",
            "path": "references.ligands.drugbank",
            "type": "string",
            "example": "DB09330",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "Ligand ChEMBL id",
            "path": "references.ligands.chembl",
            "type": "string",
            "example": "CHEMBL14830",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "Ligand PDB code",
            "path": "references.ligands.pdbid",
            "type": "string",
            "example": "HEM",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "Ligand PDB molecular formula",
            "path": "references.ligands.formula",
            "type": "string",
            "example": "C28H33N7O2",
            "options": false,
            "checkbox" : false
        },
        {
            "name": "Ligand SMILES",
            "path": "references.ligands.smiles",
            "type": "string",
            "example": "CN1C=C(C2=CC=CC=C21)C3=NC(=NC=C3)NC4=C(C=C(C(=C4)NC(=O)C=C)N(C)CCN(C)C)OC",
            "options": false,
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
    "Molecular Dynamics protocol": [
        {
            "name": "Program",
            "path": "metadata.PROGRAM",
            "type": "string",
            "example": "Gromacs",
            "options": true,
            "checkbox" : true
        },
        {
            "name": "Type",
            "path": "metadata.TYPE",
            "type": "string",
            "example": "ensemble",
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
            "name": "Timestep (fs)",
            "path": "metadata.TIMESTEP",
            "type": "float",
            "example": "2",
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
            "name": "Temperature (K)",
            "path": "metadata.TEMP",
            "type": "float",
            "example": "300",
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
            "name": "Boxtype",
            "path": "metadata.BOXTYPE",
            "type": "string",
            "example": "Triclinic",
            "options": true,
            "checkbox" : true
        }
    ],
    "Size of the simulations": [
        {
            "name": "Number of frames",
            "path": "mds.frames",
            "type": "int",
            "example": "any integer number",
            "options": false
        }, 
        {
            "name": "Framestep (ns)",
            "path": "metadata.FRAMESTEP",
            "type": "float",
            "example": "any number",
            "options": false
        },
        {
            "name": "System atom count",
            "path": "metadata.SYSTATS",
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
            "path": "metadata.PROT",
            "type": "int",
            "example": "any integer number",
            "options": false
        }
    ],
    "Protein related features": [
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
    "Topology": [
        {
            "name": "Chain names",
            "path": "topology.chain_names",
            "type": "string",
            "example": "M",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "Residue names",
            "path": "topology.residue_names",
            "type": "string",
            "example": "NME",
            "options": true,
            "checkbox" : false
        },
        {
            "name": "Atom names",
            "path": "topology.atom_names",
            "type": "string",
            "example": "OT1",
            "options": false, // Asking for options would make de request way slower
            "checkbox" : false
        },
        {
            "name": "Atom elements",
            "path": "topology.atom_elements",
            "type": "string",
            "example": "Zn",
            "options": false, // Asking for options would make de request way slower
            "checkbox" : false
        },
    ],
    "Other": [
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
            "name": "Type of partner interactions",
            "path": "metadata.INTERACTIONS.type",
            "type": "string",
            "example": "protein-protein",
            "options": true,
            "checkbox" : true
        },
        {
            "name": "Number of MDs",
            "path": "mdcount",
            "type": "int",
            "example": "any integer number",
            "options": false
        }
    ]
};