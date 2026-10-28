// React logic
import React, { useRef, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';

// This allows to render markdown
import ReactMarkdown from 'react-markdown'

// Visual assets
import Loading from 'src/components/loading';
import TextLink from 'src/components/text-link';
import { MenuList, MenuItem, Typography } from '@mui/material';

import style from './style.module.css';

import { HOST_CONFIG, BASE_PATH } from 'src/utils/constants';

import YAML from 'yaml';

// Set some markdown badges
// Gallery -> https://ileriayo.github.io/markdown-badges/
const githubBadge = '![GitHub repository](https://badgen.net/badge/icon/github?icon=github&label)';
const gitlabBadge = '![GitLab repository](https://img.shields.io/badge/gitlab-%23181717.svg?style=for-the-badge&logo=gitlab&logoColor=white)';
const jupyterBadge = '![Jupyter Notebook](https://img.shields.io/badge/jupyter-%23FA0F00.svg?style=for-the-badge&logo=jupyter&logoColor=white)';
const binderBadge = '![Binder](https://mybinder.org/badge_logo.svg)';

// Fet the GitHub or GitLab repository URL from the host configuration
const repoBaseURL = HOST_CONFIG.metaURL;
// Set the GitHub repository base name
const pathSplits = repoBaseURL.split('/');
const repoOwner = pathSplits[pathSplits.length-2];
const repoName = pathSplits[pathSplits.length-1];
const repoBase = `${repoOwner}/${repoName}`;
// Find out if it is github or gitlab
// Set the URLs accordingly
let badge;
let indexUrl;
let jupyterUrl;
let binderUrl;
if (repoBaseURL.includes('github')) {
  // Get the proper badge to be used in the repository link
  badge = githubBadge;
  // Set the URL to the index file including display instructions for this page
  indexUrl = `https://raw.githubusercontent.com/${repoBase}/refs/heads/main/index.yaml`;
  // Set the URL to the github jupyer notebook viewer
  jupyterUrl = `https://${repoBaseURL}/blob/main/notebooks/`;
  // Set the base URL to the repository where the binder enviornment and the workflows are stored
  binderUrl = `https://mybinder.org/v2/gh/${repoBase}/HEAD?labpath=notebooks%2F`;
}
else if (repoBaseURL.includes('gitlab')) {
  // Get the proper badge to be used in the repository link
  badge = gitlabBadge;
  // Set the URL to the index file including display instructions for this page
  // DANI: Here I had problems with 'Cross-Origin Request Blocked'
  indexUrl = `https://${repoBaseURL}/raw/main/index.yaml`;
  // Set the URL to the github jupyer notebook viewer
  jupyterUrl = `https://${repoBaseURL}/-/blob/main/notebooks/`;
  // Set the base URL to the repository where the binder enviornment and the workflows are stored
  binderUrl = `https://mybinder.org/v2/git/${repoBaseURL}/main?urlpath=lab/tree/`;
}
else throw new Error(`Only GitHub and GitLab repositories are supported, not ${repoBaseURL}`);

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
    if (displayIndex.error) return;
    const container = containerRefs.current;
    const refId = location.hash.slice(1);
    const linkRef = linkRefs.current[refId];
    container.scrollTop = linkRef.offsetTop - container.offsetTop;
  }, [location.hash, linkRefs]);

  // Fetch data just once
  useEffect(() => {
    // Request the GitHub index file which has the display instructions for this page
    fetch(indexUrl)
      .then(async response => {
        const actualResponse = await response.text();
        const parsedResponse = YAML.parse(actualResponse);
        setDisplayIndex(parsedResponse);
      })
      .catch(error => {
        console.error(error);
        console.error(`Failed to download ${indexUrl}`);
        setDisplayIndex({ error })
      });
  }, []);

  // Wait for data to be available
  if (displayIndex === null) return <Loading />
  if (displayIndex.error)
    return 'Something went wrong when downloading the page configuration. Look at the console.';

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
        In this page we have prepared <span className={style.highlight}>tutorials</span>{' '}
        and <span className={style.highlight}>use cases</span> of meta-analyses.
        <br />
        <br />
        Meta-analyses are analyses which use several MDs as input. This database is specially suited for this task 
        since it is endowed with a <TextLink name={'REST API'} url={BASE_PATH + 'docs/'} />. 
        Programmatic access to the database allows to automatize data requests and thus build powerful meta-analyses.
        The following examples are supported by <TextLink name={'Binder'} url={'https://mybinder.org/'} />, 
        which opens interactive <span className={style.highlight}>Jupyter Notebooks</span>.
        Note that you can edit code or run the analysis online with no need to install any software.
        Here we suggest some meta-analyses but you are very welcome to make your own ones!
        <br />
        <br />
        Original notebooks and the environment setup to run the examples are available here:
        <ReactMarkdown
          children={`[${badge}](https://${repoBaseURL})`}
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
                  children={`[${jupyterBadge}](${jupyterUrl}${notebook.notebook})`}
                  linkTarget="_blank"
                />
                <ReactMarkdown
                  children={`[${binderBadge}](${binderUrl}${notebook.notebook})`}
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
