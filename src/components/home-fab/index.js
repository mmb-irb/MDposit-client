import React, { useEffect } from 'react';
import cn from 'classnames';

import { Fab } from '@mui/material';
import { Link } from 'react-router-dom';

import useToggleState from '../../hooks/use-toggle-state';

import style from './style.module.css';

const HomeFAB = ({
  match: {
    params: { page },
  },
}) => {
  const [visible, setVisible] = useToggleState(true);

  useEffect(() => {
    if (page === 'browse' || page === 'preview') {
      setVisible(false);
    } else {
      setVisible(true);
    }
  }, [page, setVisible]);

  return (
    <div className={cn(style.button, { [style.visible]: visible })}>
      <Fab component={Link} to="/browse" variant="extended" disabled={!visible}>
        Browse
      </Fab>
    </div>
  );
};

export default HomeFAB;
