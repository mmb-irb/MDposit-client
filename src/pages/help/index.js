// React logic
import React, { useRef, useEffect, createRef } from 'react';
import { Link } from 'react-router-dom';

// Visual assets
import { MenuList, MenuItem, Typography } from '@material-ui/core';

// All text to be displayed is set previously here
import documentation from './documentation';

import style from './style.module.css';

const Help = ({ location }) => {
  // References to all documentation blocks will be stored here
  const containerRefs = useRef();
  const docRefs = useRef(Array(documentation.length).fill(createRef()));

  // Scroll down to the asked reference
  useEffect(() => {
    const container = containerRefs.current;
    for (const ref of docRefs.current) {
      if (location.hash !== '#' + ref.id) continue;
      //window.scrollTo(0, container.offsetTop);
      container.scrollTop = ref.offsetTop - container.offsetTop;
      break;
    }
  }, [location.hash]);

  return (
    <div className={style.horizontal}>
      <MenuList className={style.menu}>
        {documentation.map((doc, index) =>
          doc.title ? (
            <Typography key={index} variant="h6">
              {doc.title}
            </Typography>
          ) : (
            <MenuItem
              key={index}
              component={Link}
              to={`/help#${doc.id}`}
              style={{ whiteSpace: 'normal' }}
            >
              {doc.header}
            </MenuItem>
          ),
        )}
      </MenuList>
      <div className={style.text} ref={containerRefs}>
        {documentation.map((doc, index) => (
          <div
            key={index}
            id={doc.id}
            ref={r => (docRefs.current[index] = r)}
            className={style.paragraph}
          >
            {doc.title ? (
              <Typography variant="h5">{doc.title}</Typography>
            ) : (
              [
                <Typography
                  variant="h6"
                  className={style.header}
                  key={'header'}
                >
                  {doc.header}
                </Typography>,
                <div key={'text'}>{doc.body || doc.page}</div>,
              ]
            )}
            <hr className={style.hr} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Help;
