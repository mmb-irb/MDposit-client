import React from 'react';

import { Link } from 'react-router-dom';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';

import useAPI from '../../../hooks/use-api';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

// Render the menu of the project (i.e. the inferior header)
// It only appears when the user is inside a project
const ProjectMenu = ({ params: { accession, subPage } }) => {
  // Request all the available analyses in this project to the API
  // Then, this menu displays a tab for each analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/`,
  );

  if (error) {
    console.error(error.toString());
  }

  // Get only the analysis which are meant to have their own sheet
  let analyses = [];
  if (payload)
    // Set the analysis which have their own sheet
    analyses = payload.filter(element =>
      ['rmsd', 'rgyr', 'fluctuation', 'pca'].includes(element),
    );

  // Return each of the menu tabs
  return (
    <Tabs
      value={!loading && subPage}
      indicatorColor="secondary"
      textColor="secondary"
      variant="scrollable"
      scrollButtons="auto"
    >
      <Tab
        component={Link}
        to={`/browse/${accession}/overview`}
        label="overview"
        value="overview"
        className={style['tab-link']}
      />
      <Tab
        component={Link}
        to={`/browse/${accession}/trajectory`}
        label="trajectory"
        value="trajectory"
        className={style['tab-link']}
      />

      {!loading &&
        analyses &&
        analyses.map(analysis => (
          // Display a tab for each analysis
          <Tab
            key={analysis}
            component={Link}
            to={`/browse/${accession}/${analysis}`}
            label={analysis}
            value={analysis}
            className={style['tab-link']}
          />
        ))}

      {!loading && payload && payload.includes('rmsd-perres') && (
        <Tab
          component={Link}
          to={`/browse/${accession}/rmsd-perres`}
          label="rmsd-perres"
          value="rmsd-perres"
          className={style['tab-link']}
        />
      )}

      {!loading && payload && payload.includes('dist-perres-mean') && (
        <Tab
          component={Link}
          to={`/browse/${accession}/dist-perres`}
          label="dist-perres"
          value="dist-perres"
          className={style['tab-link']}
        />
      )}

      {!loading && payload && payload.includes('rmsd-pairwise') && (
        <Tab
          component={Link}
          to={`/browse/${accession}/rmsd-pairwise`}
          label="rmsd-pairwise"
          value="rmsd-pairwise"
          className={style['tab-link']}
        />
      )}

      {!loading && payload && payload.includes('electrostatic') && (
        <Tab
          component={Link}
          to={`/browse/${accession}/electrostatic`}
          label="electrostatic"
          value="electrostatic"
          className={style['tab-link']}
        />
      )}

      {!loading && payload && payload.includes('hbonds') && (
        <Tab
          component={Link}
          to={`/browse/${accession}/hbonds`}
          label="hbonds"
          value="hbonds"
          className={style['tab-link']}
        />
      )}

      <Tab
        component={Link}
        to={`/browse/${accession}/files`}
        label="files"
        value="files"
        className={style['tab-link']}
      />
    </Tabs>
  );
};

export default ProjectMenu;
