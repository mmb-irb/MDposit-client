import React, { useEffect, useState } from 'react';

import { Snackbar, SnackbarContent, Button, IconButton } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

const anchorOrigin = { vertical: 'bottom', horizontal: 'right' };
const reload = () => window.location.reload();

export default () => {
  const [message, setMessage] = useState(null);
  const [action, setAction] = useState(null);

  useEffect(() => {
    const reset = () => {
      setMessage(null);
      setAction(null);
    };
    let timeout;
    const handler = event => {
      switch (event.detail) {
        case 'update':
          setMessage('Updated content is available. Please reload the page.');
          setAction(
            <>
              <Button color="secondary" onClick={reload}>
                Reload
              </Button>
              <IconButton
                color="primary"
                onClick={reset}
                aria-label="close"
                size="large"
              >
                <FontAwesomeIcon icon={faTimes} />
              </IconButton>
            </>,
          );
          break;
        case 'install':
          setMessage('This website is now installed and available offline');
          setAction(
            <IconButton
              color="primary"
              onClick={reset}
              aria-label="close"
              size="large"
            >
              <FontAwesomeIcon icon={faTimes} />
            </IconButton>,
          );
          timeout = setTimeout(reset, 5000);
          break;
        default:
        //
      }
    };
    window.addEventListener('sw', handler);
    return () => {
      window.removeEventListener('sw', handler);
      clearTimeout(timeout);
    };
  }, [setMessage, setAction]);

  return (
    <Snackbar open={!!message} anchorOrigin={anchorOrigin}>
      <SnackbarContent message={message} action={action} />
    </Snackbar>
  );
};
