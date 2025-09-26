// React logic
import React, { useRef, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

// This allows to render markdown
import ReactMarkdown from 'react-markdown'

// Visual assets
import Loading from 'src/components/loading';
import { MenuList, MenuItem, Typography } from '@mui/material';

import style from './style.module.css';

import { HOST_CONFIG, BASE_PATH } from 'src/utils/constants';

import YAML from 'yaml';

// Set the GitHub repository name
const githubRepo = HOST_CONFIG.metaGithub;
// Set the URL to the github repo which sources the binder
const githubRepoBaseUrl = 'https://github.com/' + githubRepo
// Set the URL to the index file including display instructions for this page
const githubRepoIndexUrl = `https://raw.githubusercontent.com/${githubRepo}/refs/heads/main/index.yaml`;
// Set the URL to the github jupyer notebook viewer
const githubJupyterViewer = githubRepoBaseUrl + '/blob/main/notebooks/';
// Set the base URL to the repository where the binder enviornment and the workflows are stored
const binderRepoBaseUrl = `https://mybinder.org/v2/gh/${githubRepo}/HEAD?labpath=notebooks%2F`;

// Set some markdown badges
const githubBadge = '![GitHub repository](https://badgen.net/badge/icon/github?icon=github&label)';
const jupyterBadge = '![Jupyter Notebook](https://img.shields.io/badge/jupyter-%23FA0F00.svg?style=for-the-badge&logo=jupyter&logoColor=white)';
const binderBadge = '![Binder](https://mybinder.org/badge_logo.svg)';

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

  // Display instructions
  const [displayIndex, setDisplayIndex] = useState(null);

  // References to all documentation blocks will be stored here
  const containerRefs = useRef();
  const linkRefs = useRef({});

  // Scroll down to the asked reference
  useEffect(() => {
    if (displayIndex === null) return;
    const container = containerRefs.current;
    const refId = location.hash.slice(1);
    const linkRef = linkRefs.current[refId];
    container.scrollTop = linkRef.offsetTop - container.offsetTop;
  }, [location.hash, linkRefs]);

  // Fetch data just once
  useEffect(() => {
    // Request the GitHub index file which has the display instructions for this page
    fetch(githubRepoIndexUrl)
      .then(async response => {
        const actualResponse = await response.text();
        const parsedResponse = YAML.parse(actualResponse);
        setDisplayIndex(parsedResponse);
      })
      .catch(error => {
        console.error(error);
        console.error(`Failed to download ${githubRepoIndexUrl}`);
      });
  }, []);

  // Wait for data to be available
  if (displayIndex === null) return <Loading />

  return (
    <div className={style.horizontal}>
      <MenuList className={style.menu}>
        {// Iterate sections including multiple notebooks
        displayIndex.map(section => [
          <MenuItem key={section.id} component={Link} to={`/meta#${section.id}`}
            style={{ whiteSpace: 'normal', fontWeight: 'bold', fontSize: 'larger' }}
          >
            {section.title}
          </MenuItem>,
          // Iterate notebooks
          ...section.entries.map(notebook => (
            <MenuItem key={notebook.id} component={Link} to={`/meta#${notebook.id}`}
              style={{ whiteSpace: 'normal', fontWeight: 'normal', fontSize: 'normal' }}
            >
              {notebook.title}
            </MenuItem>
          ))
        ])}
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
        {displayIndex.map(section => (
          <div key={section.id} id={section.id}
            ref={r => (linkRefs.current[section.id] = r)}
            className={style.paragraph}
          >
            <Typography variant={'h5'} className={style.header}>
              {section.title}
            </Typography>
            {section.docs && <div key={'text'}>{section.docs}</div>}
            {section.entries.map(notebook => (
              <div
                key={notebook.id} id={notebook.id}
                ref={r => (linkRefs.current[notebook.id] = r)}
                className={style.paragraph}
              >
                <Typography variant={'h6'} className={style.header}>
                  {notebook.title}
                </Typography>
                {notebook.docs && <div key={'text'}>{notebook.docs}</div>}
                <ReactMarkdown
                  children={`[${jupyterBadge}](${githubJupyterViewer}${notebook.notebook})`}
                  linkTarget="_blank"
                />
                <ReactMarkdown
                  children={`[${binderBadge}](${binderRepoBaseUrl}${notebook.notebook})`}
                  linkTarget="_blank"
                />
                <hr className={style.hr} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MetaAnalysis;
