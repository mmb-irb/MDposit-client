// React logic
import React, { useRef, useEffect, createRef } from 'react';
import { Link } from 'react-router-dom';

// Visual assets
import { MenuList, MenuItem, Typography } from '@material-ui/core';

// All text to be displayed is set previously here
import { documentation, docs } from './documentation';

import style from './style.module.css';

const Help = ({ location }) => {
  // References to all documentation blocks will be stored here
  const containerRefs = useRef();
  const docRefs = useRef(Array(docs.length).fill(createRef()));

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
        {documentation.map((doc, index) => (
          <details key={index} className={style.section} open>
            <summary className={style.summary}>{doc.title}</summary>
            <br className={style.space} />
            {doc.children &&
              doc.children.map((child, c) => (
                <MenuItem
                  key={c}
                  component={Link}
                  to={`/help#${child.id}`}
                  style={{ whiteSpace: 'normal' }}
                >
                  {child.header}
                </MenuItem>
              ))}
          </details>
        ))}
      </MenuList>
      <div className={style.text} ref={containerRefs}>
        {docs.map((doc, index) => (
          <div
            key={index}
            id={doc.id}
            ref={r => (docRefs.current[index] = r)}
            className={style.paragraph}
          >
            {[
              <Typography
                variant={doc.title ? 'h5' : 'h6'}
                className={style.header}
                key={'header'}
              >
                {doc.title || doc.header}
              </Typography>,
              <div key={'text'}>{doc.body || doc.page}</div>,
            ]}
            <hr className={style.hr} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Help;
