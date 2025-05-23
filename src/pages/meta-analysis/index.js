// React logic
import React, { useRef, useEffect, createRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

// This allows to render markdown
import ReactMarkdown from 'react-markdown'

// Visual assets
import { MenuList, MenuItem, Typography } from '@mui/material';

import style from './style.module.css';

import { BASE_PATH } from '../../utils/constants';


// Set the GitHub repository name
const githubRepo = 'mmb-irb/MDDB-meta'
// Set the URL to the github repo which sources the binder
const githubRepoBaseUrl = 'https://github.com/' + githubRepo
// Set the URL to the github jupyer notebook viewer
const githubJupyterViewer = githubRepoBaseUrl + '/blob/main/notebooks/';
// Set the base URL to the repository where the binder enviornment and the workflows are stored
const binderRepoBaseUrl = `https://mybinder.org/v2/gh/${githubRepo}/HEAD?labpath=notebooks%2F`;

// Set some markdown badges
const githubBadge = '![GitHub repository](https://badgen.net/badge/icon/github?icon=github&label)';
const jupyterBadge = '![Jupyter Notebook](https://img.shields.io/badge/jupyter-%23FA0F00.svg?style=for-the-badge&logo=jupyter&logoColor=white)';
const binderBadge = '![Binder](https://mybinder.org/badge_logo.svg)';

// Set the available analyses, their introduction and the name of the notebook in the binder repository
// Include also an id for further reference. Note that this id may be visible in the URL
const availableAnalyses = [
  {
    id: 'tutorials',
    title: 'Tutorials',
    isSection : true,
  },
  {
    id: 'browsing',
    title: 'Browsing projects',
    docs:(
      <>
        This tutorial shows an example of how to browse among the different entries (projects). 
        Each project contains metadata such as names of the authors, parameters of the simulation, etc.
      </>
    ),
    notebook: 'browse_tutorial.ipynb'
  },
  {
    id: 'projects',
    title: 'Mining project data',
    docs:(
      <>
        This tutorial shows an example of how to mine data from a specific project. 
        The project is the main entry in the database and it contains mostly metadata, 
        but it is also an index of additional data which may be requested as well.
      </>
    ),
    notebook: 'project_tutorial.ipynb'
  },
  {
    id: 'trajectory',
    title: 'Visualizing trajectory data',
    docs:(
      <>
        This tutorial shows an example of how to download structure and trajectory data 
        from a specific project. Then data is loaded into a molecular viewer and displayed.
      </>
    ),
    notebook: 'trajectory_tutorial.ipynb'
  },
  {
    id: 'precalculated',
    title: 'Pre-calculated analyses',
    isSection : true,
  },
  {
    id: 'rmsd',
    title: 'RMSD analysis',
    docs:(
      <>
        In this example we reproduce the pre-calculated root mean squared deviation analysis (RMSD) performed by the data processing workflow.
      </>
    ),
    notebook: 'rmsd_analysis.ipynb'
  },
  {
    id: 'rmsf',
    title: 'Fluctuation analysis',
    docs:(
      <>
        In this example we reproduce the pre-calculated atom fluctuation analysis (RMSF) performed by the data processing workflow.
      </>
    ),
    notebook: 'rmsf_analysis.ipynb'
  },
  {
    id: 'rgyr',
    title: 'Radius of gyration analysis',
    docs:(
      <>
        In this example we reproduce the pre-calculated radius of gyrations analysis (RGYR) performed by the data processing workflow.
      </>
    ),
    notebook: 'rgyr_analysis.ipynb'
  },
  {
    id: 'usecases',
    title: 'Meta-analysis use cases',
    isSection : true,
  },
  {
    id: 'protein_ligands',
    title: 'Protein-ligands interaction analysis',
    docs:(
      <>
        In this example we intend to analyze simulations of ACE2 protein with different ligands (drugs).
        We aim to compare, for each ligand, how both electrostatic and Van de Waals energies change.
        For this test we are using 78 atomistic MD trajectories from D. E. Shaw already loaded in the MDDB database.
      </>
    ),
    notebook: 'ace2_ligands_analysis.ipynb'
  },
  {
    id: 'protein_protein',
    title: 'Protein-protein interaction analysis',
    docs:(
      <>
        In this example we intend to analyze the interaction between human angiotensin converting enzyme 2 (ACE2) 
        and the SARS-CoV-2 spike RBD domain. We want to compare, for the N501Y mutation, how electrostatic energies, 
        Van der Waals energies and hydrogen bonds change on this residue and its surrounding residues.
        <br />
        <br />
        For this test we will use RBD-ACE2 atomistic MD trajectories already loaded in the MDDB database. 
        Specifically, we will use a group of simulations from Mary Hongying Cheng including different varaints of the virus.
      </>
    ),
    notebook: 'ace2_rbd_interaction_analysis.ipynb'
  },
  {
    id: 'protein_nucleic',
    title: 'Protein-nucleic acid interaction analysis',
    docs:(
      <>
        In this example we intend to analyze the interaction between the SARS-CoV-2 polymerase complex and a fragment of RNA. 
        We want to find and visualize the aminoacid with the highest electrostatic and Van der Waals energies and thus the one 
        which is carrying the interaction.
        <br />
        <br />
        For this test we will use Polymerase atomistic MD trajectories already loaded in the MDDB database from 
        different groups.
      </>
    ),
    notebook: 'polymerase_analysis.ipynb'
  }
];

// Set a simpler TextLink component
const TextLink = ({ name, url }) => (
  <>
    <a href={url} target="_blank" rel="noreferrer noopener" >
      {name}
    </a>
  </>
);

const MetaAnalysis = () => {
  // Get the location
  const location = useLocation();

  // References to all documentation blocks will be stored here
  const containerRefs = useRef();
  const analysisRefs = useRef(Array(availableAnalyses.length).fill(createRef()));

  // Scroll down to the asked reference
  useEffect(() => {
    const container = containerRefs.current;
    for (const ref of analysisRefs.current) {
      if (location.hash !== '#' + ref.id) continue;
      //window.scrollTo(0, container.offsetTop);
      container.scrollTop = ref.offsetTop - container.offsetTop;
      break;
    }
  }, [location.hash]);

  return (
    <div className={style.horizontal}>
      <MenuList className={style.menu}>
        {availableAnalyses.map((analysis, index) => (
          <MenuItem
            key={index}
            component={Link}
            to={`/meta#${analysis.id}`}
            style={{
              whiteSpace: 'normal',
              fontWeight: analysis.isSection ? 'bold' : 'normal',
              fontSize: analysis.isSection ? 'larger' : 'normal'
            }}
          >
            {analysis.title}
          </MenuItem>
        ))}
      </MenuList>
      <div className={style.text} ref={containerRefs}>
        <Typography variant={'h5'} className={style.header}>
          Meta-analysis
        </Typography>
        In this page we have prepared <span style={{ color: 'green' }}>tutorials</span>{' '}
        and <span style={{ color: 'green' }}>use cases</span> of meta-analyses.
        <br />
        <br />
        Meta-analyses are analyses which use several MDs as input. This database is specially suited for this task 
        since it is endowed with a <TextLink name={'REST API'} url={BASE_PATH + 'docs/'} />. 
        Programmatic access to the database allows to automatize data requests and thus build powerful meta-analyses.
        The following examples are supported by <TextLink name={'Binder'} url={'https://mybinder.org/'} />, 
        which opens interactive <span style={{ color: 'green' }}>Jupyter Notebooks</span>.
        Note that you can edit code or run the analysis online with no need to install any software.
        Here we suggest some meta-analyses but you are very welcome to make your own ones!
        <br />
        <br />
        Original notebooks and the environment setup to run the examples are available here:
        <ReactMarkdown
          children={`[${githubBadge}](${githubRepoBaseUrl})`}
          linkTarget="_blank"
        />
        <hr className={style.hr} />
        {availableAnalyses.map((analysis, index) => (
          <div
            key={index}
            id={analysis.id}
            ref={r => (analysisRefs.current[index] = r)}
            className={style.paragraph}
          >
            <Typography variant={analysis.isSection ? 'h5' : 'h6'} className={style.header}>
              {analysis.title}
            </Typography>
            {!analysis.isSection && <>
              <div key={'text'}>{analysis.docs}</div>
              <ReactMarkdown
                children={`[${jupyterBadge}](${githubJupyterViewer}${analysis.notebook})`}
                linkTarget="_blank"
              />
              <ReactMarkdown
                children={`[${binderBadge}](${binderRepoBaseUrl}${analysis.notebook})`}
                linkTarget="_blank"
              />
            </>}
            <hr className={style.hr} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MetaAnalysis;
