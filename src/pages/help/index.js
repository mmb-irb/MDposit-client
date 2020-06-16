// React logic
import React, { useRef, useEffect, createRef } from 'react';

// Visual assets
import { Card, CardHeader, CardContent } from '@material-ui/core';

import style from './style.module.css';

// All text to be displayed is set previously here
const documentation = [
  {
    id: 'data-tables',
    header: 'Data tables',
    body: `Data tables are dynamic supports to handle large data sets display.
        These components allows to represent small subsets of data in a classic
         "rows and columns" format where the user can select the page and rows per
         page to be shown.`,
  },
  {
    id: 'rmsd-perres',
    header: 'RMSd per residue',
    body: `The RMSD (Root Mean Squared Deviation) per residue analysis computes the
        mean and standard deviation distance between the original position of each
        residue and their positions along each frame.
        This analysis is powered by PyTraj`,
  },
];

const Help = ({ location }) => {
  // References to all documentation blocks will be stored here
  const docRefs = useRef(Array(documentation.length).fill(createRef()));

  // Scroll down to the asked reference
  useEffect(() => {
    for (const ref of docRefs.current)
      if (location.hash === '#' + ref.id)
        return window.scrollTo(0, ref.offsetTop);
  }, [location.hash]);

  return documentation.map((doc, index) => (
    <Card
      key={index}
      id={doc.id}
      ref={r => (docRefs.current[index] = r)}
      className={style.card}
    >
      <CardHeader title={doc.header} />
      <CardContent>{doc.body}</CardContent>
    </Card>
  ));
};

export default Help;
