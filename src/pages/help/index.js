// React logic
import React, { useRef, useEffect, createRef } from 'react';

// Visual assets
import { Card, CardHeader, CardContent } from '@material-ui/core';

// All text to be displayed is set previously here
import documentation from './documentation';

import style from './style.module.css';

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
      <CardContent>{doc.body || doc.page}</CardContent>
    </Card>
  ));
};

export default Help;
